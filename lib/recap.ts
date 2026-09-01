import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveMemberNames } from "@/lib/names";
import type { Group, GroupMember, NflGame, Pick, Team, Week } from "@/lib/types";

interface RecapData {
  groupName: string;
  weekNumber: number;
  strikeLimit: number;
  survivorCount: number;
  totalPlayers: number;
  eliminatedThisWeek: string[];
  picks: { player: string; team: string; result: string }[];
  results: { matchup: string; final: string }[];
}

// Pull everything the recap needs for one week of one pool.
async function gatherRecapData(
  admin: SupabaseClient,
  group: Group,
  week: Week
): Promise<RecapData> {
  const { data: memberData } = await admin
    .from("group_members").select("*").eq("group_id", group.id);
  const members = (memberData as GroupMember[]) ?? [];
  const memberIds = members.map((m) => m.id);
  const names = await resolveMemberNames(admin, members);

  const [{ data: teamData }, { data: gameData }] = await Promise.all([
    admin.from("teams").select("*"),
    admin.from("nfl_games").select("*").eq("week_id", week.id),
  ]);
  const teams = (teamData as Team[]) ?? [];
  const games = (gameData as NflGame[]) ?? [];
  const abbr: Record<string, string> = {};
  teams.forEach((t) => (abbr[t.id] = t.abbreviation));

  const { data: pickData } = memberIds.length
    ? await admin.from("picks").select("*").eq("week_id", week.id).in("group_member_id", memberIds)
    : { data: [] as Pick[] };
  const picks = (pickData as Pick[]) ?? [];

  return {
    groupName: group.name,
    weekNumber: week.week_number,
    strikeLimit: group.strike_limit,
    survivorCount: members.filter((m) => m.status === "active").length,
    totalPlayers: members.length,
    eliminatedThisWeek: members
      .filter((m) => m.status === "eliminated" && m.eliminated_week_id === week.id)
      .map((m) => names[m.id]),
    picks: picks.map((p) => ({
      player: names[p.group_member_id] ?? "A player",
      team: abbr[p.team_id] ?? "?",
      result: p.result,
    })),
    results: games
      .filter((g) => g.status === "final")
      .map((g) => ({
        matchup: `${abbr[g.away_team_id]} @ ${abbr[g.home_team_id]}`,
        final:
          g.away_score != null && g.home_score != null
            ? `${g.away_score}-${g.home_score}`
            : "final",
      })),
  };
}

function fallbackHtml(d: RecapData): string {
  const elim =
    d.eliminatedThisWeek.length > 0
      ? `<p>Eliminated this week: <strong>${d.eliminatedThisWeek.join(", ")}</strong>. Pour one out.</p>`
      : `<p>Nobody went out this week — everyone lives to pick again.</p>`;
  const picks = d.picks
    .map((p) => `<li>${p.player}: ${p.team} (${p.result})</li>`)
    .join("");
  return `<p><strong>Week ${d.weekNumber} — ${d.groupName}</strong></p>
    <p>${d.survivorCount} of ${d.totalPlayers} still standing.</p>
    ${elim}
    ${picks ? `<p>The picks:</p><ul>${picks}</ul>` : ""}`;
}

// Ask Claude for a fun recap; fall back to a plain template if no API key.
async function generateHtml(d: RecapData): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackHtml(d);
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1500,
      output_config: { effort: "low" },
      system:
        "You are the wisecracking commissioner of an NFL survivor pool writing a short weekly recap email to the group chat. " +
        "Return ONLY an HTML fragment — no <html>/<head>/<body> wrapper, no markdown code fences. " +
        "Use <p>, <strong>, and a single <ul><li> list if helpful. Keep it ~120–200 words. " +
        "Voice: playful, light trash talk, PG-13, hype the survivors and gently roast anyone eliminated. " +
        "Base everything ONLY on the JSON data provided — never invent scores, players, or outcomes. " +
        "If a field is empty, just don't mention it.",
      messages: [
        {
          role: "user",
          content:
            "Write the Week " +
            d.weekNumber +
            " recap from this data:\n\n" +
            JSON.stringify(d),
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text");
    const html = text && "text" in text ? text.text.trim() : "";
    return html || fallbackHtml(d);
  } catch {
    return fallbackHtml(d);
  }
}

// Build the subject + HTML body for a week's recap.
export async function buildRecap(
  admin: SupabaseClient,
  group: Group,
  week: Week
): Promise<{ subject: string; html: string }> {
  const data = await gatherRecapData(admin, group, week);
  const html = await generateHtml(data);
  return { subject: `🏈 Week ${week.week_number} recap — ${group.name}`, html };
}
