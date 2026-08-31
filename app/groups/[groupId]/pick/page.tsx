import { loadGroupContext } from "@/lib/group";
import { getCurrentWeek, deadlinePassed } from "@/lib/week";
import PickForm from "@/components/PickForm";
import type { NflGame, Pick, Team } from "@/lib/types";

const RESULT_ICON: Record<string, string> = {
  win: "✅", loss: "❌", tie: "➖", missed: "🚫", pending: "•",
};

export default async function PickPage({
  params,
}: {
  params: { groupId: string };
}) {
  const { supabase, group, membership } = await loadGroupContext(params.groupId);

  const week = await getCurrentWeek(supabase, group.season);
  if (!week) {
    return (
      <p className="text-stone-500">
        No schedule loaded yet. Once the commissioner syncs this week&apos;s NFL
        games, you&apos;ll pick here.
      </p>
    );
  }

  const [{ data: gameData }, { data: teamData }, { data: allPicks }] = await Promise.all([
    supabase.from("nfl_games").select("*").eq("week_id", week.id).order("kickoff_time"),
    supabase.from("teams").select("*"),
    supabase.from("picks").select("*").eq("group_member_id", membership.id),
  ]);

  const games = (gameData as NflGame[]) ?? [];
  const teams = (teamData as Team[]) ?? [];
  const teamsById: Record<string, Team> = {};
  teams.forEach((t) => (teamsById[t.id] = t));

  const myPicks = (allPicks as Pick[]) ?? [];
  const thisWeekPicks = myPicks.filter((p) => p.week_id === week.id);
  const usedTeamIds = myPicks.filter((p) => p.week_id !== week.id).map((p) => p.team_id);

  const locked = membership.status !== "active" || deadlinePassed(week);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          Week {week.week_number}
          {week.phase === "playoffs" ? " (Playoffs)" : ""}
        </h2>
        {membership.status !== "active" && (
          <p className="text-sm text-red-600">You&apos;ve been eliminated in this pool.</p>
        )}
      </div>

      {games.length === 0 ? (
        <p className="text-stone-500">No games loaded for this week yet.</p>
      ) : locked ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-600">
            {membership.status !== "active"
              ? "You can't pick — you've been eliminated."
              : "🔒 Picks are locked for this week. Here's what you submitted."}
          </p>
          {thisWeekPicks.length === 0 ? (
            <p className="text-sm text-red-600">
              You didn&apos;t submit a pick this week — that&apos;s a strike once
              scored.
            </p>
          ) : (
            <ul className="space-y-2">
              {thisWeekPicks.map((p) => (
                <li key={p.id} className="card flex items-center justify-between">
                  <span className="font-semibold">{teamsById[p.team_id]?.name ?? "—"}</span>
                  <span className="text-sm">
                    {RESULT_ICON[p.result] ?? "•"} {p.result}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <PickForm
          groupId={group.id}
          weekId={week.id}
          deadlineIso={week.pick_deadline}
          picksRequired={week.picks_required}
          games={games}
          teamsById={teamsById}
          usedTeamIds={usedTeamIds}
          initialSelected={thisWeekPicks.map((p) => p.team_id)}
        />
      )}
    </div>
  );
}
