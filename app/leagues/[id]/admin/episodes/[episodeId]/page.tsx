import Link from "next/link";
import { redirect } from "next/navigation";
import { loadLeagueContext } from "@/lib/league";
import ScoringEventForm from "@/components/ScoringEventForm";
import {
  addQuestion,
  setQuestionCorrect,
  deleteQuestion,
  deleteScoringEvent,
  setEpisodeScored,
} from "@/app/leagues/[id]/admin/actions";
import type { Castaway, Episode, PickemQuestion, ScoringEvent } from "@/lib/types";

export default async function EpisodeAdminPage({
  params,
}: {
  params: { id: string; episodeId: string };
}) {
  const { supabase, league, isCommissioner } = await loadLeagueContext(params.id);
  if (!isCommissioner) redirect(`/leagues/${league.id}`);

  const [{ data: episode }, { data: castaways }, { data: questions }, { data: events }] =
    await Promise.all([
      supabase.from("episodes").select("*").eq("id", params.episodeId).maybeSingle(),
      supabase.from("castaways").select("*").eq("league_id", league.id).order("name"),
      supabase
        .from("pickem_questions")
        .select("*")
        .eq("episode_id", params.episodeId)
        .order("sort_order"),
      supabase
        .from("scoring_events")
        .select("*")
        .eq("episode_id", params.episodeId)
        .order("created_at"),
    ]);

  if (!episode) redirect(`/leagues/${league.id}/admin`);

  const ep = episode as Episode;
  const cast = (castaways ?? []) as Castaway[];
  const qs = (questions ?? []) as PickemQuestion[];
  const evs = (events ?? []) as ScoringEvent[];
  const nameOf = (id: string) => cast.find((c) => c.id === id)?.name ?? "—";

  const addQuestionAction = addQuestion.bind(null, league.id, ep.id);
  const scoredToggle = setEpisodeScored.bind(null, league.id, ep.id, !ep.is_scored);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/leagues/${league.id}/admin`} className="text-sm text-stone-400 hover:text-stone-600">
            ← Back to commissioner tools
          </Link>
          <h2 className="mt-1 text-xl font-bold">
            Week {ep.week_number}
            {ep.title ? ` — ${ep.title}` : ""}
          </h2>
          <p className="text-sm text-stone-500">
            {ep.is_scored ? "Scored ✓ — counts in pick'em standings" : "Not yet scored"}
          </p>
        </div>
        <form action={scoredToggle}>
          <button className="btn-ghost">{ep.is_scored ? "Mark as not scored" : "Mark week scored"}</button>
        </form>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Fantasy scoring */}
        <section>
          <h3 className="mb-2 text-lg font-semibold">🏝️ Fantasy scoring</h3>
          <p className="mb-3 text-sm text-stone-500">
            Award points to castaways for what they did this episode. Points flow
            to whoever drafted them.
          </p>
          <ScoringEventForm leagueId={league.id} episodeId={ep.id} castaways={cast} />

          <div className="card mt-4">
            {evs.length === 0 ? (
              <p className="text-sm text-stone-500">No scoring entered yet.</p>
            ) : (
              evs.map((e) => {
                const del = deleteScoringEvent.bind(null, league.id, ep.id, e.id);
                return (
                  <div key={e.id} className="flex items-center justify-between border-t border-stone-100 py-2 text-sm first:border-t-0">
                    <span>
                      <strong>{nameOf(e.castaway_id)}</strong>{" "}
                      <span className="text-stone-500">· {e.event_type}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`font-semibold ${e.points < 0 ? "text-red-600" : "text-jungle-700"}`}>
                        {e.points > 0 ? `+${e.points}` : e.points}
                      </span>
                      <form action={del}>
                        <button className="text-xs text-red-500 hover:text-red-700">✕</button>
                      </form>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Pick'em questions */}
        <section>
          <h3 className="mb-2 text-lg font-semibold">🗳️ Pick&apos;em questions</h3>
          <p className="mb-3 text-sm text-stone-500">
            Add prediction questions. After the episode, set the correct answer —
            matching picks score automatically once the week is marked scored.
          </p>

          <form action={addQuestionAction} className="card mb-4 space-y-2">
            <input name="prompt" required placeholder="e.g. Who gets voted out this week?" className="input" />
            <div className="grid grid-cols-3 gap-2">
              <select name="question_type" className="input col-span-1">
                <option value="castaway">Castaway</option>
                <option value="text">Text/Yes-No</option>
              </select>
              <input name="points" type="number" step="0.5" defaultValue={1} placeholder="Points" className="input" />
              <input name="sort_order" type="number" defaultValue={qs.length} placeholder="Order" className="input" />
            </div>
            <button className="btn-primary w-full">Add question</button>
          </form>

          <div className="space-y-3">
            {qs.length === 0 ? (
              <p className="text-sm text-stone-500">No questions yet.</p>
            ) : (
              qs.map((q) => {
                const setCorrect = setQuestionCorrect.bind(null, league.id, ep.id, q.id);
                const del = deleteQuestion.bind(null, league.id, ep.id, q.id);
                return (
                  <div key={q.id} className="card">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{q.prompt}</p>
                      <form action={del}>
                        <button className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </form>
                    </div>
                    <p className="mt-1 text-xs text-stone-400">
                      {q.points} pt{q.points === 1 ? "" : "s"} · {q.question_type}
                    </p>
                    <form action={setCorrect} className="mt-3 flex items-end gap-2">
                      {q.question_type === "castaway" ? (
                        <div className="flex-1">
                          <label className="label">Correct answer</label>
                          <select name="correct_castaway_id" defaultValue={q.correct_castaway_id ?? ""} className="input">
                            <option value="">— not set —</option>
                            {cast.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <label className="label">Correct answer</label>
                          <input name="correct_text" defaultValue={q.correct_text ?? ""} placeholder="e.g. Yes" className="input" />
                        </div>
                      )}
                      <button className="btn-ghost">Save</button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
