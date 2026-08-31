import Link from "next/link";
import { loadGroupContext } from "@/lib/group";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import GroupTabs from "@/components/GroupTabs";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { groupId: string };
}) {
  const { group, isCommish, user } = await loadGroupContext(params.groupId);

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

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

        <div className="mt-4">
          <GroupTabs groupId={group.id} isCommish={isCommish} />
        </div>
        <div className="py-6">{children}</div>
      </main>
    </>
  );
}
