import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { createLeague, joinLeague } from "./actions";
import { updateDisplayName } from "@/app/auth/actions";
import type { League } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Leagues the user belongs to.
  const { data: memberships } = await supabase
    .from("league_members")
    .select("role, leagues(*)")
    .eq("user_id", user.id);

  const leagues =
    (memberships
      ?.map((m) => ({ role: m.role, league: m.leagues as unknown as League }))
      .filter((m) => m.league) ?? []);

  return (
    <>
      <AppHeader displayName={profile?.display_name} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your leagues</h1>
        </div>

        {searchParams.error === "notfound" && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            No league found with that invite code. Double-check it with your
            commissioner.
          </p>
        )}

        {/* League list */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {leagues.length === 0 && (
            <p className="text-stone-500">
              You&apos;re not in any leagues yet. Create one or join a friend&apos;s below.
            </p>
          )}
          {leagues.map(({ league, role }) => (
            <Link key={league.id} href={`/leagues/${league.id}`} className="card transition hover:border-ember-400 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-stone-900">{league.name}</h2>
                  <p className="text-sm text-stone-500">{league.season_name}</p>
                </div>
                {role === "commissioner" && (
                  <span className="badge bg-ember-100 text-ember-700">Commissioner</span>
                )}
              </div>
              <p className="mt-4 text-xs text-stone-400">
                Invite code: <span className="font-mono font-semibold text-stone-600">{league.invite_code}</span>
              </p>
            </Link>
          ))}
        </div>

        {/* Create + Join */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <form action={createLeague} className="card space-y-3">
            <h3 className="font-semibold">Create a league</h3>
            <div>
              <label className="label" htmlFor="name">League name</label>
              <input id="name" name="name" required placeholder="The Merge Mafia" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="season_name">Season</label>
              <input id="season_name" name="season_name" placeholder="Survivor 48" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="roster_size">Castaways per team</label>
              <input id="roster_size" name="roster_size" type="number" min={1} max={10} defaultValue={4} className="input" />
            </div>
            <button type="submit" className="btn-primary w-full">Create league</button>
          </form>

          <div className="space-y-6">
            <form action={joinLeague} className="card space-y-3">
              <h3 className="font-semibold">Join a league</h3>
              <div>
                <label className="label" htmlFor="invite_code">Invite code</label>
                <input id="invite_code" name="invite_code" required placeholder="A1B2C3" className="input font-mono uppercase" />
              </div>
              <button type="submit" className="btn-ghost w-full">Join</button>
            </form>

            <form action={updateDisplayName} className="card space-y-3">
              <h3 className="font-semibold">Your display name</h3>
              <input name="display_name" defaultValue={profile?.display_name ?? ""} className="input" />
              <button type="submit" className="btn-ghost w-full">Save name</button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
