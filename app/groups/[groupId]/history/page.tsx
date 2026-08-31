import { loadGroupContext } from "@/lib/group";
import type { NflGame, Pick, Team, Week } from "@/lib/types";

const RESULT_ICON: Record<string, string> = {
  win: "✅", loss: "❌", tie: "➖", missed: "🚫", pending: "•",
};

export default async function HistoryPage({
  params,
}: {
  params: { groupId: string };
}) {
  const { supabase, group, membership } = await loadGroupContext(params.groupId);

  const [{ data: pickData }, { data: weekData }, { data: teamData }, { data: gameData }] =
    await Promise.all([
      supabase.from("picks").select("*").eq("group_member_id", membership.id),
      supabase.from("weeks").select("*").eq("season", group.season).order("week_number"),
      supabase.from("teams").select("*"),
      supabase.from("nfl_games").select("*"),
    ]);

  const picks = (pickData as Pick[]) ?? [];
  const weeks = (weekData as Week[]) ?? [];
  const teams = (teamData as Team[]) ?? [];
  const games = (gameData as NflGame[]) ?? [];

  const teamById: Record<string, Team> = {};
  teams.forEach((t) => (teamById[t.id] = t));
  const weekById: Record<string, Week> = {};
  weeks.forEach((w) => (weekById[w.id] = w));

  // Find the game (and its score) for a picked team in a given week.
  function gameFor(weekId: string, teamId: string): NflGame | undefined {
    return games.find(
      (g) => g.week_id === weekId && (g.home_team_id === teamId || g.away_team_id === teamId)
    );
  }

  const rows = picks
    .map((p) => ({ pick: p, week: weekById[p.week_id] }))
    .filter((r) => r.week)
    .sort((a, b) => a.week!.week_number - b.week!.week_number);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">My picks</h2>
      {rows.length === 0 ? (
        <p className="text-stone-500">You haven&apos;t made any picks yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-2">Week</th>
                <th className="px-4 py-2">Pick</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ pick, week }) => {
                const g = gameFor(pick.week_id, pick.team_id);
                const score =
                  g && g.home_score != null && g.away_score != null
                    ? `${teamById[g.away_team_id]?.abbreviation} ${g.away_score} – ${g.home_score} ${teamById[g.home_team_id]?.abbreviation}`
                    : "—";
                return (
                  <tr key={pick.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">Week {week!.week_number}</td>
                    <td className="px-4 py-2 font-medium">{teamById[pick.team_id]?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      {RESULT_ICON[pick.result] ?? "•"} {pick.result}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-500">{score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
