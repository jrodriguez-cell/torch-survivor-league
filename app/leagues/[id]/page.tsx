import { loadLeagueContext } from "@/lib/league";
import type { StandingRow } from "@/lib/types";

function medal(rank: number) {
  return ["🥇", "🥈", "🥉"][rank] ?? `${rank + 1}.`;
}

export default async function StandingsPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, league } = await loadLeagueContext(params.id);

  const [{ data: fantasy }, { data: pickem }, { data: members }] =
    await Promise.all([
      supabase.from("fantasy_standings").select("*").eq("league_id", league.id),
      supabase.from("pickem_standings").select("*").eq("league_id", league.id),
      supabase
        .from("league_members")
        .select("user_id, profiles(display_name)")
        .eq("league_id", league.id),
    ]);

  const fantasyRows = (fantasy ?? []) as StandingRow[];
  const pickemRows = (pickem ?? []) as StandingRow[];

  // Build a combined leaderboard keyed by user.
  const byUser = new Map<
    string,
    { name: string; fantasy: number; pickem: number }
  >();

  for (const m of members ?? []) {
    const prof = m.profiles as unknown as { display_name: string } | null;
    byUser.set(m.user_id, {
      name: prof?.display_name ?? "Player",
      fantasy: 0,
      pickem: 0,
    });
  }
  for (const r of fantasyRows) {
    const row = byUser.get(r.user_id);
    if (row) row.fantasy = Number(r.total_points);
  }
  for (const r of pickemRows) {
    const row = byUser.get(r.user_id);
    if (row) row.pickem = Number(r.total_points);
  }

  const combined = [...byUser.values()]
    .map((r) => ({ ...r, total: r.fantasy + r.pickem }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-8">
      {/* Combined leaderboard */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">🏆 Overall standings</h2>
        {combined.length === 0 ? (
          <p className="text-stone-500">No players yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Player</th>
                  <th className="px-4 py-2 text-right">Fantasy</th>
                  <th className="px-4 py-2 text-right">Pick&apos;em</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {combined.map((r, i) => (
                  <tr key={r.name + i} className="border-t border-stone-100">
                    <td className="px-4 py-2">{medal(i)}</td>
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-right text-stone-500">{r.fantasy}</td>
                    <td className="px-4 py-2 text-right text-stone-500">{r.pickem}</td>
                    <td className="px-4 py-2 text-right font-bold text-ember-700">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <MiniBoard title="🏝️ Fantasy points" rows={combined.map((r) => ({ name: r.name, pts: r.fantasy }))} />
        <MiniBoard title="🗳️ Pick'em points" rows={combined.map((r) => ({ name: r.name, pts: r.pickem }))} />
      </div>
    </div>
  );
}

function MiniBoard({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; pts: number }[];
}) {
  const sorted = [...rows].sort((a, b) => b.pts - a.pts);
  return (
    <section className="card">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="divide-y divide-stone-100">
        {sorted.map((r, i) => (
          <li key={r.name + i} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="mr-2 text-stone-400">{i + 1}.</span>
              {r.name}
            </span>
            <span className="font-semibold">{r.pts}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
