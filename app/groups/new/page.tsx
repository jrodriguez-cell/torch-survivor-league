import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { createGroup } from "@/app/dashboard/actions";
import { CURRENT_SEASON } from "@/lib/types";

export default async function NewGroupPage() {
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

  return (
    <>
      <AppHeader displayName={profile?.display_name} />
      <main className="mx-auto max-w-lg px-4 py-8">
        <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Start a new pool</h1>
        <p className="mt-1 text-sm text-stone-500">
          You&apos;ll be the commissioner. Share the invite code afterward to bring
          your friends in.
        </p>

        <form action={createGroup} className="card mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">Pool name</label>
            <input id="name" name="name" required placeholder="The Group Chat Survivor Pool" className="input" />
          </div>

          <div>
            <label className="label" htmlFor="strike_limit">Strikes allowed before elimination</label>
            <select id="strike_limit" name="strike_limit" className="input" defaultValue="1">
              <option value="1">1 strike — classic (one bad week and you&apos;re out)</option>
              <option value="2">2 strikes — more forgiving</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="is_public" className="h-4 w-4" />
            Make this pool public (anyone can find and join it)
          </label>

          <p className="text-xs text-stone-400">Season: {CURRENT_SEASON}</p>

          <button type="submit" className="btn-primary w-full">Create pool</button>
        </form>
      </main>
    </>
  );
}
