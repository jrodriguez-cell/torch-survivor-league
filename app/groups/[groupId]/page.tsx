import Link from "next/link";
import { loadGroupContext } from "@/lib/group";
import { resolveMemberNames } from "@/lib/names";
import type { GroupMember } from "@/lib/types";

export default async function GroupOverviewPage({
  params,
}: {
  params: { groupId: string };
}) {
  const { supabase, group } = await loadGroupContext(params.groupId);

  const { data: members } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", group.id)
    .order("joined_at");

  const rows = (members as GroupMember[]) ?? [];
  const names = await resolveMemberNames(supabase, rows);

  const alive = rows.filter((m) => m.status === "active").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Link href={`/groups/${group.id}/pick`} className="btn-primary">
          Make this week&apos;s pick
        </Link>
        <Link href={`/groups/${group.id}/standings`} className="btn-ghost">
          View standings
        </Link>
      </div>

      <p className="mb-2 text-sm text-stone-500">
        {alive} of {rows.length} still alive
      </p>

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
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-stone-100">
                <td className="px-4 py-2 font-medium">
                  {names[m.id]}
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
    </div>
  );
}
