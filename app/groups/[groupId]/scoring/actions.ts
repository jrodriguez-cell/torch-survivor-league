"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadGroupContext } from "@/lib/group";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescoreSeason, syncScores } from "@/lib/nfl-sync";
import { buildRecap } from "@/lib/recap";
import { sendHtmlEmail } from "@/lib/email";
import type { NflGame, Week } from "@/lib/types";

async function requireCommish(groupId: string) {
  const ctx = await loadGroupContext(groupId);
  if (!ctx.isCommish) redirect(`/groups/${groupId}`);
  return ctx;
}

function revalidateGroup(groupId: string) {
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/standings`);
  revalidatePath(`/groups/${groupId}/pick`);
  revalidatePath(`/groups/${groupId}/history`);
  revalidatePath(`/groups/${groupId}/scoring`);
}

// Mark a game final with a score; winner is inferred (tie if equal). Then
// re-resolve picks and recompute strikes/eliminations.
export async function setGameFinal(
  groupId: string,
  gameId: string,
  homeScore: number,
  awayScore: number
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: g } = await admin.from("nfl_games").select("*").eq("id", gameId).maybeSingle();
  const game = g as NflGame | null;
  if (!game) return { ok: false, message: "Game not found." };

  const winnerTeamId =
    homeScore > awayScore ? game.home_team_id : awayScore > homeScore ? game.away_team_id : null;

  await admin
    .from("nfl_games")
    .update({
      status: "final",
      home_score: homeScore,
      away_score: awayScore,
      winner_team_id: winnerTeamId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return {
    ok: true,
    message: winnerTeamId ? "Marked final; picks resolved." : "Marked final (tie); picks resolved.",
  };
}

// Undo a final result: back to scheduled, reset its picks to pending, clear the
// week's strikes, and recompute (strikes re-derive from whatever's still final).
export async function reopenGame(
  groupId: string,
  gameId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: g } = await admin.from("nfl_games").select("*").eq("id", gameId).maybeSingle();
  const game = g as NflGame | null;
  if (!game) return { ok: false, message: "Game not found." };

  await admin
    .from("nfl_games")
    .update({ status: "scheduled", home_score: null, away_score: null, winner_team_id: null })
    .eq("id", gameId);
  await admin
    .from("picks")
    .update({ result: "pending" })
    .eq("week_id", game.week_id)
    .in("team_id", [game.home_team_id, game.away_team_id]);
  await admin.from("member_strikes").delete().eq("week_id", game.week_id);

  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: "Game reopened; results reset." };
}

// Directly override one member's pick result (API-hiccup escape hatch).
export async function overridePick(
  groupId: string,
  pickId: string,
  result: "pending" | "win" | "loss" | "tie" | "missed"
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  await admin.from("picks").update({ result }).eq("id", pickId);
  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: `Pick set to ${result}.` };
}

// Send the AI-written weekly recap to everyone in the pool.
export async function sendRecap(
  groupId: string,
  weekId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: w } = await admin.from("weeks").select("*").eq("id", weekId).maybeSingle();
  const week = w as Week | null;
  if (!week) return { ok: false, message: "Week not found." };

  const { data: members } = await admin
    .from("group_members").select("user_id").eq("group_id", group.id);
  const emails: string[] = [];
  for (const m of members ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.user_id as string);
    if (data.user?.email) emails.push(data.user.email);
  }
  if (!emails.length) return { ok: false, message: "No recipient emails found." };

  // Refresh scores + resolve picks so the recap reflects current results.
  try { await syncScores(); } catch { /* send with best-available data */ }
  const { subject, html } = await buildRecap(admin, group, week);
  const ok = await sendHtmlEmail(emails, subject, html);
  return ok
    ? { ok: true, message: `Recap sent to ${emails.length} player(s).` }
    : { ok: false, message: "Email isn't configured (set RESEND_API_KEY) or the send failed." };
}

// Send a test recap to just the commissioner (to confirm email works).
export async function sendTestRecap(
  groupId: string,
  weekId: string
): Promise<{ ok: boolean; message: string }> {
  const { group, user } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: w } = await admin.from("weeks").select("*").eq("id", weekId).maybeSingle();
  const week = w as Week | null;
  if (!week) return { ok: false, message: "Week not found." };
  if (!user.email) return { ok: false, message: "Your account has no email address." };

  // Refresh scores + resolve picks so the test reflects current results.
  try { await syncScores(); } catch { /* send with best-available data */ }
  const { subject, html } = await buildRecap(admin, group, week);
  const ok = await sendHtmlEmail(user.email, `[TEST] ${subject}`, html);
  return ok
    ? { ok: true, message: `Test recap sent to ${user.email}. Check your inbox.` }
    : { ok: false, message: "Email isn't configured (set RESEND_API_KEY) or the send failed." };
}

// Commissioner escape hatch: place (or replace) the COMMISSIONER'S OWN pick for
// any week — including one whose deadline has already passed — without touching
// anyone else's picks or reopening the week for the rest of the pool.
//
// The pick-rules DB trigger rejects writes after the deadline, so we briefly
// restore a future deadline just long enough to write this one row, then put the
// real deadline back (in a finally). No other member's picks are read or changed.
export async function commishSetOwnPick(
  groupId: string,
  weekId: string,
  teamIds: string[]
): Promise<{ ok: boolean; message: string }> {
  const { group, membership } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: w } = await admin.from("weeks").select("*").eq("id", weekId).maybeSingle();
  const week = w as Week | null;
  if (!week) return { ok: false, message: "Week not found." };

  const unique = [...new Set(teamIds.filter(Boolean))];
  if (unique.length !== week.picks_required) {
    return {
      ok: false,
      message: `Pick exactly ${week.picks_required} ${week.picks_required === 1 ? "team" : "different teams"} for Week ${week.week_number}.`,
    };
  }

  // Teams must be playing that week.
  const { data: gameData } = await admin
    .from("nfl_games").select("home_team_id, away_team_id").eq("week_id", weekId);
  const playing = new Set<string>();
  for (const g of gameData ?? []) {
    playing.add(g.home_team_id as string);
    playing.add(g.away_team_id as string);
  }
  if (unique.some((t) => !playing.has(t))) {
    return { ok: false, message: "One of those teams isn't playing that week." };
  }

  // Survivor rule: no reusing a team taken in a DIFFERENT week.
  const { data: priorPicks } = await admin
    .from("picks").select("team_id, week_id").eq("group_member_id", membership.id).neq("week_id", weekId);
  const used = new Set((priorPicks ?? []).map((p) => p.team_id as string));
  if (unique.some((t) => used.has(t))) {
    return { ok: false, message: "You've already used one of those teams this season." };
  }

  const originalDeadline = week.pick_deadline;
  try {
    // Lift the deadline + ensure the commissioner is active so the trigger allows
    // the write, then swap in the new pick row(s) for the commissioner only.
    await admin.from("weeks")
      .update({ pick_deadline: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", weekId);
    if (membership.status !== "active") {
      await admin.from("group_members").update({ status: "active" }).eq("id", membership.id);
    }
    await admin.from("picks").delete().eq("group_member_id", membership.id).eq("week_id", weekId);
    const rows = unique.map((teamId) => ({
      group_member_id: membership.id, week_id: weekId, team_id: teamId, locked_at: null,
    }));
    const { error } = await admin.from("picks").insert(rows);
    if (error) return { ok: false, message: error.message };
  } finally {
    // Always put the real deadline back so the week stays locked for everyone else.
    await admin.from("weeks").update({ pick_deadline: originalDeadline }).eq("id", weekId);
  }

  // Clear only the commissioner's stale strike for this week (e.g. a "missed"
  // strike from having no pick) so scoring re-derives it from the new pick.
  await admin.from("member_strikes")
    .delete().eq("group_member_id", membership.id).eq("week_id", weekId);
  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: `Your Week ${week.week_number} pick is in.` };
}

// Reinstate an eliminated player: forgive all their strikes and set them back
// to active so they can pick again. Commissioner override. Because scoring
// re-derives status from the strike ledger, we clear their ledger rows too —
// otherwise the next sync would immediately re-eliminate them.
export async function reinstateMember(
  groupId: string,
  memberId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: m } = await admin
    .from("group_members")
    .select("id, group_id")
    .eq("id", memberId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (!m) return { ok: false, message: "Player not found in this pool." };

  await admin.from("member_strikes").delete().eq("group_member_id", memberId);
  await admin
    .from("group_members")
    .update({ status: "active", strikes_used: 0, eliminated_week_id: null })
    .eq("id", memberId);

  // Recompute so everything stays consistent (charges strikes only for weeks
  // whose deadline has already passed — the current, open week is untouched).
  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: "Player reinstated — strikes cleared, back to active." };
}

// Reopen a locked week for picking. Sets the deadline to the kickoff of the
// next game that hasn't started yet (so late-deciding players can still get in
// before the next games), or, if every game has already started, a short grace
// window from now. Commissioner override — this can let someone pick after some
// of the week's games have played, so it's on the commish to use it fairly.
export async function reopenPicks(
  groupId: string,
  weekId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: gameData } = await admin
    .from("nfl_games")
    .select("kickoff_time, status")
    .eq("week_id", weekId);
  const games = (gameData as { kickoff_time: string; status: string }[]) ?? [];
  if (!games.length) {
    return { ok: false, message: "No games loaded for this week yet — load the schedule first." };
  }

  const now = Date.now();
  // Next kickoff among games that haven't kicked off yet.
  const upcoming = games
    .filter((g) => g.status === "scheduled")
    .map((g) => new Date(g.kickoff_time).getTime())
    .filter((t) => !Number.isNaN(t) && t > now)
    .sort((a, b) => a - b);

  let newDeadline: Date;
  let note: string;
  if (upcoming.length) {
    newDeadline = new Date(upcoming[0]);
    note = `Picks reopen until the next kickoff (${newDeadline.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    })}).`;
  } else {
    // Every game has already started/finished — give a short manual grace window.
    newDeadline = new Date(now + 3 * 60 * 60 * 1000);
    note =
      "All of this week's games have already started, so picks are open for the next 3 hours " +
      "as a manual override. Heads up: some results may already be known.";
  }

  await admin.from("weeks").update({ pick_deadline: newDeadline.toISOString() }).eq("id", weekId);
  // Clear this week's strikes so nobody stays penalised for a missed pick while
  // the window is reopened; they re-derive after the new deadline passes.
  await admin.from("member_strikes").delete().eq("week_id", weekId);
  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: note };
}

// Lock a week's picks immediately (emergencies / testing). Re-syncing the
// schedule restores the real kickoff-based deadline.
export async function lockWeekNow(
  groupId: string,
  weekId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  await admin.from("weeks").update({ pick_deadline: new Date().toISOString() }).eq("id", weekId);
  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: "Picks locked for this week." };
}
