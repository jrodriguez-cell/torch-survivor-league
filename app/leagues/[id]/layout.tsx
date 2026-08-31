import Link from "next/link";
import { loadLeagueContext } from "@/lib/league";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import LeagueTabs from "@/components/LeagueTabs";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { league, isCommissioner, user } = await loadLeagueContext(params.id);

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <AppHeader displayName={profile?.display_name} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600">
            ← All leagues
          </Link>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold">{league.name}</h1>
              <p className="text-sm text-stone-500">{league.season_name}</p>
            </div>
            <div className="text-right text-xs text-stone-400">
              Invite friends with code
              <div className="font-mono text-lg font-bold text-ember-600">
                {league.invite_code}
              </div>
            </div>
          </div>
        </div>

        <LeagueTabs leagueId={league.id} isCommissioner={isCommissioner} />
        <div className="py-6">{children}</div>
      </main>
    </>
  );
}
