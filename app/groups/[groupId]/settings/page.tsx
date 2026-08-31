import { redirect } from "next/navigation";
import { loadGroupContext } from "@/lib/group";
import { resolveMemberNames } from "@/lib/names";
import {
  updateGroupSettings,
  regenerateInviteCode,
  removeMember,
} from "./actions";
import type { GroupMember } from "@/lib/types";

export default async function SettingsPage({
  params,
}: {
  params: { groupId: string };
}) {
  const { supabase, group, isCommish } = await loadGroupContext(params.groupId);
  if (!isCommish) redirect(`/groups/${group.id}`);

  const { data: memberData } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", group.id)
    .order("joined_at");
  const members = (memberData as GroupMember[]) ?? [];
  const names = await resolveMemberNames(supabase, members);

  const saveSettings = updateGroupSettings.bind(null, group.id);
  const regen = regenerateInviteCode.bind(null, group.id);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Pool settings</h2>
        <form action={saveSettings} className="card space-y-4">
          <div>
            <label className="label" htmlFor="name">Pool name</label>
            <input id="name" name="name" defaultValue={group.name} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="strike_limit">Strikes before elimination</label>
            <select id="strike_limit" name="strike_limit" defaultValue={String(group.strike_limit)} className="input">
              <option value="1">1 strike</option>
              <option value="2">2 strikes</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="is_public" defaultChecked={group.is_public} className="h-4 w-4" />
            Public pool (discoverable by anyone)
          </label>
          <button className="btn-primary">Save settings</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Invite code</h2>
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-mono text-xl font-bold text-ember-600">{group.invite_code}</div>
            <p className="text-xs text-stone-400">Share this so friends can join.</p>
          </div>
          <form action={regen}>
            <button className="btn-ghost">Regenerate</button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Members</h2>
        <div className="card divide-y divide-stone-100">
          {members.map((m) => {
            const del = removeMember.bind(null, group.id, m.id);
            const isCommishRow = m.user_id === group.commish_id;
            return (
              <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">
                  {names[m.id]}
                  {isCommishRow && <span className="ml-2 badge bg-ember-100 text-ember-700">Commish</span>}
                  {m.status === "eliminated" && <span className="ml-2 badge bg-red-100 text-red-700">Out</span>}
                </span>
                {!isCommishRow && (
                  <form action={del}>
                    <button className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Manual pick overrides and a &quot;force re-sync&quot; button arrive with
          the live scoring in the next phase.
        </p>
      </section>
    </div>
  );
}
