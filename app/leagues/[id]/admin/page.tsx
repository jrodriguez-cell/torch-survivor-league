import Link from "next/link";
import { redirect } from "next/navigation";
import { loadLeagueContext } from "@/lib/league";
import CastawayAdminRow from "@/components/CastawayAdminRow";
import { addCastaway, addEpisode, setEpisodeScored } from "./actions";
import type { Castaway, Episode } from "@/lib/types";

export default async function AdminPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, league, isCommissioner } = await loadLeagueContext(params.id);
  if (!isCommissioner) redirect(`/leagues/${league.id}`);

  const [{ data: castaways }, { data: episodes }] = await Promise.all([
    supabase.from("castaways").select("*").eq("league_id", league.id).order("name"),
    supabase
      .from("episodes")
      .select("*")
      .eq("league_id", league.id)
      .order("week_number", { ascending: false }),
  ]);

  const cast = (castaways ?? []) as Castaway[];
  const eps = (episodes ?? []) as Episode[];

  const addCastawayAction = addCastaway.bind(null, league.id);
  const addEpisodeAction = addEpisode.bind(null, league.id);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Castaways */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">Castaways</h2>
        <p className="mb-4 text-sm text-stone-500">
          Add the season&apos;s cast. Members draft these for their fantasy team.
        </p>

        <form action={addCastawayAction} className="card mb-4 space-y-2">
          <input name="name" required placeholder="Castaway name" className="input" />
          <div className="grid grid-cols-2 gap-2">
            <input name="tribe" placeholder="Tribe (optional)" className="input" />
            <input name="image_url" placeholder="Photo URL (optional)" className="input" />
          </div>
          <button className="btn-primary w-full">Add castaway</button>
        </form>

        <div className="card">
          {cast.length === 0 ? (
            <p className="text-sm text-stone-500">No castaways yet.</p>
          ) : (
            cast.map((c) => (
              <CastawayAdminRow key={c.id} leagueId={league.id} castaway={c} />
            ))
          )}
        </div>
      </section>

      {/* Episodes */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">Weeks / Episodes</h2>
        <p className="mb-4 text-sm text-stone-500">
          Add each week, set when picks lock, then open a week to enter scoring
          and pick&apos;em questions.
        </p>

        <form action={addEpisodeAction} className="card mb-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input name="week_number" type="number" min={1} required placeholder="Week #" className="input" />
            <input name="title" placeholder="Title (optional)" className="input col-span-2" />
          </div>
          <div>
            <label className="label" htmlFor="picks_lock_at">Picks lock at</label>
            <input id="picks_lock_at" name="picks_lock_at" type="datetime-local" className="input" />
          </div>
          <button className="btn-primary w-full">Add week</button>
        </form>

        <div className="space-y-2">
          {eps.length === 0 ? (
            <p className="text-sm text-stone-500">No weeks yet.</p>
          ) : (
            eps.map((e) => {
              const scoredToggle = setEpisodeScored.bind(
                null,
                league.id,
                e.id,
                !e.is_scored
              );
              return (
                <div key={e.id} className="card flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      Week {e.week_number}
                      {e.title ? ` — ${e.title}` : ""}
                    </div>
                    <div className="text-xs text-stone-500">
                      {e.picks_lock_at
                        ? `Locks ${new Date(e.picks_lock_at).toLocaleString()}`
                        : "No lock time"}
                      {e.is_scored && " · Scored ✓"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/leagues/${league.id}/admin/episodes/${e.id}`}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      Manage
                    </Link>
                    <form action={scoredToggle}>
                      <button className="btn-ghost px-3 py-1.5 text-xs">
                        {e.is_scored ? "Unscore" : "Mark scored"}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
