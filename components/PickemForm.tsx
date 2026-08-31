"use client";

import { useState, useTransition } from "react";
import type { Castaway, PickemQuestion } from "@/lib/types";
import { savePicks } from "@/app/leagues/[id]/pickem/actions";

export default function PickemForm({
  leagueId,
  episodeId,
  questions,
  castaways,
  initialAnswers,
}: {
  leagueId: string;
  episodeId: string;
  questions: PickemQuestion[];
  castaways: Castaway[];
  initialAnswers: Record<string, { castawayId?: string | null; text?: string | null }>;
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function setCastaway(qid: string, cid: string) {
    setMsg(null);
    setAnswers((p) => ({ ...p, [qid]: { castawayId: cid } }));
  }
  function setText(qid: string, text: string) {
    setMsg(null);
    setAnswers((p) => ({ ...p, [qid]: { text } }));
  }

  function onSave() {
    setMsg(null);
    const payload = questions.map((q) => ({
      questionId: q.id,
      castawayId: answers[q.id]?.castawayId ?? null,
      text: answers[q.id]?.text ?? null,
    }));
    startTransition(async () => {
      const res = await savePicks(leagueId, episodeId, payload);
      setMsg(res.ok ? "Picks saved! 🔒 Good luck." : res.message ?? "Error.");
    });
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <div key={q.id} className="card">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="font-medium">{q.prompt}</p>
            <span className="badge shrink-0 bg-stone-100 text-stone-600">
              {q.points} pt{q.points === 1 ? "" : "s"}
            </span>
          </div>

          {q.question_type === "castaway" ? (
            <select
              className="input"
              value={answers[q.id]?.castawayId ?? ""}
              onChange={(e) => setCastaway(q.id, e.target.value)}
            >
              <option value="">— Choose a castaway —</option>
              {castaways.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_eliminated ? " (out)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              placeholder="Your answer"
              value={answers[q.id]?.text ?? ""}
              onChange={(e) => setText(q.id, e.target.value)}
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save my picks"}
        </button>
        {msg && <span className="text-sm text-stone-600">{msg}</span>}
      </div>
    </div>
  );
}
