import { redirect } from "next/navigation";
import { loadGroupContext } from "@/lib/group";
import { getCurrentWeek, deadlinePassed } from "@/lib/week";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMemberNames } from "@/lib/names";
import ScoringAdmin from "@/components/ScoringAdmin";
import type { GroupMember, NflGame, Pick, Team } from "@/lib/types";

export default async function ScoringPage({
  params,
}: {
  params: { groupId: string };
}) {
  const { supabase, group, isCommish } = await loadGroupContext(params.groupId);
  if (!isCommish) redirect(`/groups/${group.id}`);

  const week = await getCurrentWeek(supabase, group.season);
  if (!week) {
    return <p className="text-stone-500">No week loaded yet — sync the schedule first.</p>;
  }

  // Commissioner needs to see everyone's picks (incl. before deadline), so read
  // with the service role here (this page is commish-guarded above).
  const admin = createAdminClient();
  const [{ data: gameData }, { data: teamData }, { data: memberData }] = await Promise.all([
    admin.from("nfl_games").select("*").eq("week_id", week.id).order("kickoff_time"),
    admin.from("teams").select("*"),
    admin.from("group_members").select("*").eq("group_id", group.id),
  ]);

  const games = (gameData as NflGame[]) ?? [];
  const teams = (teamData as Team[]) ?? [];
  const members = (memberData as GroupMember[]) ?? [];
  const abbr: Record<string, string> = {};
  teams.forEach((t) => (abbr[t.id] = t.abbreviation));

  const memberIds = members.map((m) => m.id);
  const { data: pickData } = memberIds.length
    ? await admin.from("picks").select("*").eq("week_id", week.id).in("group_member_id", memberIds)
    : { data: [] as Pick[] };
  const picks = (pickData as Pick[]) ?? [];
  const names = await resolveMemberNames(admin, members);

  const memberRows = members.map((m) => ({
    id: m.id,
    name: names[m.id],
    picks: picks
      .filter((p) => p.group_member_id === m.id)
      .map((p) => ({ id: p.id, teamAbbr: abbr[p.team_id] ?? "—", result: p.result })),
  }));

  const gameRows = games.map((g) => ({
    id: g.id,
    homeAbbr: abbr[g.home_team_id] ?? "—",
    awayAbbr: abbr[g.away_team_id] ?? "—",
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
  }));

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Scoring &amp; overrides</h2>
      <p className="mb-6 text-sm text-stone-500">
        Commissioner tools to fix results the automatic sync got wrong, or to
        test scoring. Changes immediately re-resolve picks and recompute strikes.
      </p>
      <ScoringAdmin
        groupId={group.id}
        week={{ id: week.id, number: week.week_number, deadlinePassed: deadlinePassed(week) }}
        games={gameRows}
        members={memberRows}
      />
    </div>
  );
}
