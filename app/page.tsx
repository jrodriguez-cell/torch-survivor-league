import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gradient-to-b from-jungle-900 via-jungle-800 to-jungle-700 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-6xl">🔥</div>
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight">Torch</h1>
        <p className="mt-4 max-w-xl text-lg text-jungle-100">
          Run a fantasy Survivor league with your friends. Draft castaways,
          rack up points as they outwit, outplay, and outlast — and settle it
          each week with a pick&apos;em.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-3">
          {[
            { emoji: "🏝️", title: "Draft your tribe", body: "Pick castaways and earn their points all season." },
            { emoji: "🗳️", title: "Weekly pick'em", body: "Predict boots, idols, and immunity each episode." },
            { emoji: "🏆", title: "Live standings", body: "Two leaderboards, one champion. Bragging rights included." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-white/10 p-5 text-left backdrop-blur">
              <div className="text-2xl">{f.emoji}</div>
              <div className="mt-2 font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-jungle-100">{f.body}</div>
            </div>
          ))}
        </div>

        <Link href="/login" className="mt-10 btn bg-ember-500 px-8 py-3 text-base text-white hover:bg-ember-600">
          Get started — it&apos;s free
        </Link>
        <p className="mt-3 text-xs text-jungle-200">
          A side project, just for fun. Bring your friends.
        </p>
      </div>
    </main>
  );
}
