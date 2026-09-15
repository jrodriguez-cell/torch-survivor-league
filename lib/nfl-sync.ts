import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchScoreboard, type Scoreboard } from "@/lib/nfl-data";
import { sendEliminationEmail } from "@/lib/email";

type StrikeReason = "loss" | "tie" | "missed" | "mixed";

async function teamIdByAbbr(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await admin.from("teams").select("id, abbreviation");
  const map = new Map<string, string>();
  for (const t of data ?? []) map.set(t.abbreviation as string, t.id as string);
  return map;
}

// Upsert a fetched scoreboard's week + games; refresh the deadline and remove
// stale games for that week (e.g. earlier test seed rows).
async function upsertBoard(admin: SupabaseClient, board: Scoreboard) {
  const teamMap = await teamIdByAbbr(admin);

  const { data: existing } = await admin
    .from("weeks")
    .select("*")
    .eq("season", board.season)
    .eq("week_number", board.weekNumber)
    .maybeSingle();

  const kickoffs = board.games.map((g) => g.kickoff).filter(Boolean).sort();
  const deadline = kickoffs[0] ?? existing?.pick_deadline ?? new Date().toISOString();

  let weekId: string;
  if (existing) {
    await admin
      .from("weeks")
      .update({ pick_deadline: deadline, phase: board.phase })
      .eq("id", existing.id);
    weekId = existing.id as string;
  } else {
    const picksRequired =
      board.phase === "regular" && board.weekNumber >= 13 && board.weekNumber <= 18 ? 2 : 1;
    const { data: ins, error } = await admin
      .from("weeks")
      .insert({
        season: board.season,
        week_number: board.weekNumber,
        phase: board.phase,
        pick_deadline: deadline,
        picks_required: picksRequired,
      })
      .select("id")
      .single();
    if (error || !ins) throw new Error(error?.message ?? "Could not create week");
    weekId = ins.id as string;
  }

  const rows: Record<string, unknown>[] = [];
  const extIds: string[] = [];
  for (const g of board.games) {
    const home = teamMap.get(g.homeAbbr);
    const away = teamMap.get(g.awayAbbr);
    if (!home || !away) continue; // unknown abbreviation — skip
    extIds.push(g.externalId);
    rows.push({
      week_id: weekId,
      home_team_id: home,
      away_team_id: away,
      kickoff_time: g.kickoff,
      status: g.status,
      home_score: g.homeScore,
      away_score: g.awayScore,
      winner_team_id: g.winnerAbbr ? teamMap.get(g.winnerAbbr) ?? null : null,
      external_id: g.externalId,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length) {
    await admin.from("nfl_games").upsert(rows, { onConflict: "external_id" });
    const inList = `(${extIds.map((id) => `"${id}"`).join(",")})`;
    await admin.from("nfl_games").delete().eq("week_id", weekId).not("external_id", "in", inList);
  }

  return { weekId, weekNumber: board.weekNumber, season: board.season, games: rows.length };
}

// Set result on submitted picks for every game that is final.
async function resolvePickResults(admin: SupabaseClient, season: number) {
  const { data: weeks } = await admin.from("weeks").select("id").eq("season", season);
  const weekIds = (weeks ?? []).map((w) => w.id as string);
  if (!weekIds.length) return;

  const { data: games } = await admin
    .from("nfl_games")
    .select("*")
    .in("week_id", weekIds)
    .eq("status", "final");

  for (const g of games ?? []) {
    const weekId = g.week_id as string;
    const home = g.home_team_id as string;
    const away = g.away_team_id as string;
    const winner = g.winner_team_id as string | null;

    if (winner) {
      await admin.from("picks").update({ result: "win" })
        .eq("week_id", weekId).eq("team_id", winner).eq("result", "pending");
      await admin.from("picks").update({ result: "loss" })
        .eq("week_id", weekId).in("team_id", [home, away]).neq("team_id", winner).eq("result", "pending");
    } else {
      await admin.from("picks").update({ result: "tie" })
        .eq("week_id", weekId).in("team_id", [home, away]).eq("result", "pending");
    }
  }
}

// Charge idempotent, week-level strikes and eliminate members who hit the limit.
async function computeStrikesAndElimination(admin: SupabaseClient, season: number) {
  const nowIso = new Date().toISOString();

  const { data: weekData } = await admin
    .from("weeks")
    .select("id, week_number, picks_required, pick_deadline")
    .eq("season", season)
    .lt("pick_deadline", nowIso);
  const weeks = weekData ?? [];
  if (!weeks.length) return;
  const weekNumberById = new Map(weeks.map((w) => [w.id as string, w.week_number as number]));

  const { data: groupData } = await admin
    .from("groups").select("id, strike_limit, name").eq("season", season);
  const groups = groupData ?? [];
  const strikeLimitByGroup = new Map(groups.map((g) => [g.id as string, g.strike_limit as number]));
  const groupNameById = new Map(groups.map((g) => [g.id as string, g.name as string]));
  const groupIds = groups.map((g) => g.id as string);
  if (!groupIds.length) return;

  const { data: memberData } = await admin
    .from("group_members").select("*").in("group_id", groupIds);
  const members = memberData ?? [];
  const memberIds = members.map((m) => m.id as string);
  if (!memberIds.length) return;

  const { data: pickData } = await admin
    .from("picks").select("group_member_id, week_id, result").in("group_member_id", memberIds);
  // picks[member][week] = results[]
  const picksByMemberWeek = new Map<string, string[]>();
  for (const p of pickData ?? []) {
    const key = `${p.group_member_id}|${p.week_id}`;
    (picksByMemberWeek.get(key) ?? picksByMemberWeek.set(key, []).get(key)!).push(p.result as string);
  }

  const { data: existingStrikes } = await admin
    .from("member_strikes").select("group_member_id, week_id").in("group_member_id", memberIds);
  const haveStrike = new Set((existingStrikes ?? []).map((s) => `${s.group_member_id}|${s.week_id}`));

  // Decide new strikes.
  const newStrikes: { group_member_id: string; week_id: string; reason: StrikeReason }[] = [];
  for (const m of members) {
    const memberId = m.id as string;
    for (const w of weeks) {
      const weekId = w.id as string;
      const key = `${memberId}|${weekId}`;
      if (haveStrike.has(key)) continue;

      const required = w.picks_required as number;
      const results = picksByMemberWeek.get(key) ?? [];

      let reason: StrikeReason | null = null;
      if (results.length < required) {
        // Missing a required pick after the deadline — can never be filled.
        reason = results.length === 0 ? "missed" : "mixed";
      } else if (!results.includes("pending")) {
        const bad = results.filter((r) => r !== "win");
        if (bad.length > 0) {
          reason = bad.every((r) => r === bad[0]) ? (bad[0] as StrikeReason) : "mixed";
        }
      }
      // else: some picks still pending — wait for those games to finish.

      if (reason) newStrikes.push({ group_member_id: memberId, week_id: weekId, reason });
    }
  }

  if (newStrikes.length) {
    await admin.from("member_strikes").upsert(newStrikes, {
      onConflict: "group_member_id,week_id",
      ignoreDuplicates: true,
    });
  }

  // Recompute strikes_used + elimination from the ledger (idempotent).
  const { data: allStrikes } = await admin
    .from("member_strikes").select("group_member_id, week_id").in("group_member_id", memberIds);
  const strikesByMember = new Map<string, string[]>();
  for (const s of allStrikes ?? []) {
    const arr = strikesByMember.get(s.group_member_id as string) ?? [];
    arr.push(s.week_id as string);
    strikesByMember.set(s.group_member_id as string, arr);
  }

  const newlyEliminated: { userId: string; groupId: string }[] = [];

  for (const m of members) {
    const memberId = m.id as string;
    const limit = strikeLimitByGroup.get(m.group_id as string) ?? 1;
    const weekIds = strikesByMember.get(memberId) ?? [];
    const used = weekIds.length;

    let status = "active";
    let eliminatedWeekId: string | null = null;
    if (used >= limit) {
      status = "eliminated";
      // The week that pushed them to the limit = the limit-th strike by week order.
      const ordered = [...weekIds].sort(
        (a, b) => (weekNumberById.get(a) ?? 0) - (weekNumberById.get(b) ?? 0)
      );
      eliminatedWeekId = ordered[limit - 1] ?? ordered[ordered.length - 1] ?? null;
    }

    // Only write if something changed.
    if (m.strikes_used !== used || m.status !== status || m.eliminated_week_id !== eliminatedWeekId) {
      await admin
        .from("group_members")
        .update({ strikes_used: used, status, eliminated_week_id: eliminatedWeekId })
        .eq("id", memberId);
      if (status === "eliminated" && m.status !== "eliminated") {
        newlyEliminated.push({ userId: m.user_id as string, groupId: m.group_id as string });
      }
    }
  }

  // Best-effort elimination emails (no-op if email isn't configured).
  for (const e of newlyEliminated) {
    try {
      const { data } = await admin.auth.admin.getUserById(e.userId);
      const email = data.user?.email;
      if (email) await sendEliminationEmail(email, groupNameById.get(e.groupId) ?? "your pool");
    } catch {
      // ignore email failures
    }
  }
}

// Pull the current week's schedule + games only (early-week schedule sync).
export async function syncSchedule(opts?: { season?: number; week?: number; seasonType?: number }) {
  const admin = createAdminClient();
  const board = await fetchScoreboard(opts);
  return upsertBoard(admin, board);
}

// Re-run pick resolution + strikes/elimination for a season WITHOUT touching
// ESPN — used after a commissioner manually overrides a game or pick result.
export async function rescoreSeason(season: number) {
  const admin = createAdminClient();
  await resolvePickResults(admin, season);
  await computeStrikesAndElimination(admin, season);
}

// Re-fetch any PAST week (deadline passed) that still has games not marked
// final/postponed, so a week that didn't finalize live (e.g. the cron wasn't
// running that week) gets caught up. Without this, syncScores only ever looks
// at the current ESPN week and old weeks stay stuck as 'scheduled'.
async function backfillIncompleteWeeks(admin: SupabaseClient, season: number) {
  const nowIso = new Date().toISOString();
  const { data: weeks } = await admin
    .from("weeks")
    .select("id, week_number, phase, pick_deadline")
    .eq("season", season)
    .lt("pick_deadline", nowIso);

  for (const w of weeks ?? []) {
    const { data: games } = await admin
      .from("nfl_games").select("status").eq("week_id", w.id as string);
    const rows = (games as { status: string }[]) ?? [];
    const incomplete =
      rows.length === 0 || rows.some((g) => g.status !== "final" && g.status !== "postponed");
    if (!incomplete) continue;

    try {
      const board = await fetchScoreboard({
        season,
        week: w.week_number as number,
        seasonType: w.phase === "playoffs" ? 3 : 2,
      });
      await upsertBoard(admin, board);
    } catch {
      // ESPN hiccup for this week — leave it for the next run.
    }
  }
}

// Full live pass: refresh current week's scores, backfill any earlier week that
// didn't finalize, resolve picks, charge strikes, and eliminate. Idempotent —
// safe to run every few minutes.
export async function syncScores(opts?: { season?: number; week?: number; seasonType?: number }) {
  const admin = createAdminClient();
  const board = await fetchScoreboard(opts);
  const summary = await upsertBoard(admin, board);
  await backfillIncompleteWeeks(admin, board.season);
  await resolvePickResults(admin, board.season);
  await computeStrikesAndElimination(admin, board.season);
  return summary;
}
