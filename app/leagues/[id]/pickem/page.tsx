import { loadLeagueContext } from "@/lib/league";
import PickemForm from "@/components/PickemForm";
import type { Castaway, Episode, PickemQuestion } from "@/lib/types";

export default async function PickemPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, user, league } = await loadLeagueContext(params.id);

  const [{ data: episodes }, { data: castaways }] = await Promise.all([
    supabase
      .from("episodes")
      .select("*")
      .eq("league_id", league.id)
      .order("week_number", { ascending: false }),
    supabase.from("castaways").select("*").eq("league_id", league.id).order("name"),
  ]);

  const eps = (episodes ?? []) as Episode[];
  // Feature the earliest not-yet-scored episode (the one people are picking now).
  const openEps = eps.filter((e) => !e.is_scored);
  const active = openEps[openEps.length - 1] ?? eps[0];

  if (!active) {
    return (
      <p className="text-stone-500">
        No episodes yet. Your commissioner will add this week&apos;s episode and
        pick&apos;em questions.
      </p>
    );
  }

  const { data: questions } = await supabase
    .from("pickem_questions")
    .select("*")
    .eq("episode_id", active.id)
    .order("sort_order");

  const qs = (questions ?? []) as PickemQuestion[];

  const { data: myAnswers } = await supabase
    .from("pickem_answers")
    .select("question_id, answer_castaway_id, answer_text")
    .eq("user_id", user.id)
    .in("question_id", qs.map((q) => q.id).length ? qs.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"]);

  const initialAnswers: Record<string, { castawayId?: string | null; text?: string | null }> = {};
  for (const a of myAnswers ?? []) {
    initialAnswers[a.question_id] = {
      castawayId: a.answer_castaway_id,
      text: a.answer_text,
    };
  }

  const locked =
    active.is_scored ||
    (active.picks_lock_at != null && new Date(active.picks_lock_at) < new Date());

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">
          Week {active.week_number}
          {active.title ? ` — ${active.title}` : ""}
        </h2>
        {active.picks_lock_at && (
          <p className="text-sm text-stone-500">
            Picks lock {new Date(active.picks_lock_at).toLocaleString()}
          </p>
        )}
      </div>

      {qs.length === 0 ? (
        <p className="text-stone-500">
          No pick&apos;em questions for this week yet.
        </p>
      ) : locked ? (
        <LockedView questions={qs} castaways={(castaways ?? []) as Castaway[]} answers={initialAnswers} />
      ) : (
        <PickemForm
          leagueId={league.id}
          episodeId={active.id}
          questions={qs}
          castaways={(castaways ?? []) as Castaway[]}
          initialAnswers={initialAnswers}
        />
      )}
    </div>
  );
}

function LockedView({
  questions,
  castaways,
  answers,
}: {
  questions: PickemQuestion[];
  castaways: Castaway[];
  answers: Record<string, { castawayId?: string | null; text?: string | null }>;
}) {
  const nameOf = (id?: string | null) =>
    castaways.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-600">
        🔒 Picks are locked for this week. Here&apos;s what you submitted.
      </p>
      {questions.map((q) => {
        const mine = answers[q.id];
        const myAns = q.question_type === "castaway" ? nameOf(mine?.castawayId) : mine?.text ?? "—";
        const correct =
          q.question_type === "castaway"
            ? nameOf(q.correct_castaway_id)
            : q.correct_text ?? null;
        const graded = q.correct_castaway_id != null || (q.correct_text ?? "") !== "";
        const gotIt =
          q.question_type === "castaway"
            ? mine?.castawayId && mine.castawayId === q.correct_castaway_id
            : mine?.text && correct && mine.text.trim().toLowerCase() === correct.trim().toLowerCase();
        return (
          <div key={q.id} className="card">
            <p className="font-medium">{q.prompt}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="badge bg-stone-100 text-stone-600">You: {myAns}</span>
              {graded && (
                <>
                  <span className="badge bg-jungle-600/10 text-jungle-800">
                    Answer: {correct}
                  </span>
                  <span className={`badge ${gotIt ? "bg-jungle-600 text-white" : "bg-red-100 text-red-700"}`}>
                    {gotIt ? `+${q.points}` : "0"}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
