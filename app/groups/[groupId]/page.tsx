import Link from "next/link";
import { loadGroupContext } from "@/lib/group";
import AppHeader from "@/components/AppHeader";
import type { GroupMember } from "@/lib/types";

export default async function GroupHomePage({
  params,
}: {
  params: { groupId: string };
}) {
  const { supabase, user, group, isCommish } = await loadGroupContext(params.groupId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: members } = await supabase
    .from("group_members")
    .select("*, profiles(display_name)")
    .eq("group_id", group.id)
    .order("joined_at");

  const memberRows =
    (members as (GroupMember & { profiles: { display_name: string } | null })[]) ?? [];

  return (
    <>
      <AppHeader displayName={profile?.display_name} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600">
          ← All pools
        </Link>

        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p className="text-sm text-stone-500">
              {group.season} season · {group.strike_limit} strike
              {group.strike_limit === 1 ? "" : "s"} to elimination
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3 text-right">
            <div className="text-xs text-stone-400">Invite code</div>
            <div className="font-mono text-lg font-bold text-ember-600">{group.invite_code}</div>
          </div>
        </div>

        {/* Placeholder nav for the pages coming in Phase 3 */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Make a pick", desc: "Choose this week's team", soon: true },
            { label: "Standings", desc: "Who's still alive", soon: true },
            { label: "My history", desc: "Your past picks", soon: true },
            ...(isCommish ? [{ label: "Settings", desc: "Commissioner tools", soon: true }] : []),
          ].map((t) => (
            <div key={t.label} className="card opacity-70">
              <div className="font-semibold">{t.label}</div>
              <div className="text-xs text-stone-500">{t.desc}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-stone-400">Coming next</div>
            </div>
          ))}
        </div>

        {/* Members */}
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Members ({memberRows.length})</h2>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-2">Player</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Strikes</th>
                </tr>
              </thead>
              <tbody>
                {memberRows.map((m) => (
                  <tr key={m.id} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-medium">
                      {m.display_name || m.profiles?.display_name || "Player"}
                      {m.user_id === group.commish_id && (
                        <span className="ml-2 badge bg-ember-100 text-ember-700">Commish</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {m.status === "eliminated" ? (
                        <span className="text-red-600">Eliminated</span>
                      ) : (
                        <span className="text-jungle-700">Alive</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-500">
                      {m.strikes_used}/{group.strike_limit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
