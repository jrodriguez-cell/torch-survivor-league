import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME, APP_EMOJI } from "@/lib/branding";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gradient-to-b from-jungle-900 via-jungle-800 to-jungle-700 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-6xl">{APP_EMOJI}</div>
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight">{APP_NAME}</h1>
        <p className="mt-4 max-w-xl text-lg text-jungle-100">
          The classic NFL survivor pool for you and your friends. Pick one team
          to win each week — but you can only use each team once. Lose, and
          you&apos;re on a strike. The last one standing takes the pot.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-3">
          {[
            { emoji: "✅", title: "One pick a week", body: "Choose a team to win. Each team only once all season." },
            { emoji: "❌", title: "Miss = strike", body: "A loss, tie, or missed deadline costs you a strike." },
            { emoji: "🏆", title: "Last one standing", body: "Outlast your friends. Commissioner sets the strike limit." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-white/10 p-5 text-left backdrop-blur">
              <div className="text-2xl">{f.emoji}</div>
              <div className="mt-2 font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-jungle-100">{f.body}</div>
            </div>
          ))}
        </div>

        <Link href="/signup" className="mt-10 btn bg-ember-500 px-8 py-3 text-base text-white hover:bg-ember-600">
          Create your account
        </Link>
        <p className="mt-3 text-sm text-jungle-200">
          Already playing?{" "}
          <Link href="/login" className="font-semibold text-white underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
