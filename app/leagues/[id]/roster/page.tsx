import { loadLeagueContext } from "@/lib/league";
import RosterEditor from "@/components/RosterEditor";
import type { Castaway } from "@/lib/types";

export default async function RosterPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, user, league } = await loadLeagueContext(params.id);

  const { data: castaways } = await supabase
    .from("castaways")
    .select("*")
    .eq("league_id", league.id)
    .order("name");

  // Load the user's current picks, if any.
  const { data: roster } = await supabase
    .from("rosters")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  let initialSelected: string[] = [];
  if (roster) {
    const { data: picks } = await supabase
      .from("roster_castaways")
      .select("castaway_id")
      .eq("roster_id", roster.id);
    initialSelected = (picks ?? []).map((p) => p.castaway_id);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">My Team</h2>
        <p className="text-sm text-stone-500">
          Draft up to {league.roster_size} castaways. You earn all of their
          fantasy points as the season plays out.
        </p>
      </div>
      <RosterEditor
        leagueId={league.id}
        rosterSize={league.roster_size}
        castaways={(castaways ?? []) as Castaway[]}
        initialSelected={initialSelected}
      />
    </div>
  );
}
