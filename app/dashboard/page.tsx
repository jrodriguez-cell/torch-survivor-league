import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { joinByCode } from "./actions";
import { updateDisplayName } from "@/app/auth/actions";
import type { Group, GroupMember } from "@/lib/types";

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

  const { data: memberships } = await supabase
    .from("group_members")
    .select("status, strikes_used, groups(*)")
    .eq("user_id", user.id);

  const rows =
    (memberships
      ?.map((m) => ({
        status: m.status as GroupMember["status"],
        strikes: m.strikes_used as number,
        group: m.groups as unknown as Group,
      }))
      .filter((r) => r.group) ?? []);

  return (
    <>
      <AppHeader displayName={profile?.display_name} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Your pools</h1>
          <Link href="/groups/new" className="btn-primary">
            + New pool
          </Link>
        </div>

        {searchParams.error === "badcode" && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            That invite code didn&apos;t match any pool. Double-check it with the
            commissioner.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.length === 0 && (
            <p className="text-stone-500">
              You&apos;re not in any pools yet. Create one, or join a friend&apos;s
              with an invite code below.
            </p>
          )}
          {rows.map(({ group, status, strikes }) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="card transition hover:border-ember-400 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-stone-900">{group.name}</h2>
                  <p className="text-sm text-stone-500">{group.season} season</p>
                </div>
                {status === "eliminated" ? (
                  <span className="badge bg-red-100 text-red-700">Eliminated</span>
                ) : (
                  <span className="badge bg-jungle-600/10 text-jungle-800">Alive</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-stone-400">
                <span>
                  Strikes: {strikes}/{group.strike_limit}
                </span>
                {group.commish_id === user.id && (
                  <span className="badge bg-ember-100 text-ember-700">Commissioner</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <form action={joinByCode} className="card space-y-3">
            <h3 className="font-semibold">Join a pool</h3>
            <div>
              <label className="label" htmlFor="invite_code">Invite code</label>
              <input id="invite_code" name="invite_code" required placeholder="A1B2C3D4"
                className="input font-mono uppercase" />
            </div>
            <button type="submit" className="btn-ghost w-full">Join</button>
          </form>

          <form action={updateDisplayName} className="card space-y-3">
            <h3 className="font-semibold">Your display name</h3>
            <input name="display_name" defaultValue={profile?.display_name ?? ""} className="input" />
            <button type="submit" className="btn-ghost w-full">Save name</button>
          </form>
        </div>
      </main>
    </>
  );
}
