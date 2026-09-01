"use client";

import { useState, useTransition } from "react";
import {
  setGameFinal,
  reopenGame,
  overridePick,
  lockWeekNow,
} from "@/app/groups/[groupId]/scoring/actions";

type GameRow = {
  id: string;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
};
type PickRow = { id: string; teamAbbr: string; result: string };
type MemberRow = { id: string; name: string; picks: PickRow[] };

const RESULTS = ["pending", "win", "loss", "tie", "missed"] as const;

export default function ScoringAdmin({
  groupId,
  week,
  games,
  members,
}: {
  groupId: string;
  week: { id: string; number: number; deadlinePassed: boolean };
  games: GameRow[];
  members: MemberRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>(() => {
    const init: Record<string, { h: string; a: string }> = {};
    for (const g of games) init[g.id] = { h: g.homeScore?.toString() ?? "", a: g.awayScore?.toString() ?? "" };
    return init;
  });

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    startTransition(async () => setMsg((await fn()).message));
  }

  return (
    <div className="space-y-8">
      {msg && <p className="rounded-lg bg-stone-100 p-2 text-sm text-stone-700">{msg}</p>}

      {!week.deadlinePassed && (
        <section className="card">
          <h3 className="font-semibold">Picks are still open</h3>
          <p className="mb-3 text-sm text-stone-500">
            Strikes are only charged after the deadline. To test scoring now (or
            close early), lock this week. Re-syncing the schedule restores the
            real deadline.
          </p>
          <button
            className="btn-ghost"
            disabled={pending}
            onClick={() => run(() => lockWeekNow(groupId, week.id))}
          >
            Lock Week {week.number} picks now
          </button>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-lg font-semibold">Game results (Week {week.number})</h3>
        <p className="mb-3 text-sm text-stone-500">
          Enter a final score to resolve picks. Winner is inferred; equal scores
          count as a tie.
        </p>
        <div className="space-y-2">
          {games.map((g) => (
            <div key={g.id} className="card flex flex-wrap items-center gap-2">
              <span className="w-14 text-right text-sm font-semibold">{g.awayAbbr}</span>
              <input
                type="number" className="input w-16 py-1" value={scores[g.id]?.a ?? ""}
                onChange={(e) => setScores((s) => ({ ...s, [g.id]: { ...s[g.id], a: e.target.value } }))}
              />
              <span className="text-xs text-stone-400">@</span>
              <input
                type="number" className="input w-16 py-1" value={scores[g.id]?.h ?? ""}
                onChange={(e) => setScores((s) => ({ ...s, [g.id]: { ...s[g.id], h: e.target.value } }))}
              />
              <span className="w-14 text-sm font-semibold">{g.homeAbbr}</span>
              <span className="ml-2 text-xs text-stone-400">{g.status}</span>
              <span className="ml-auto flex gap-2">
                <button
                  className="btn-primary px-3 py-1 text-xs" disabled={pending}
                  onClick={() =>
                    run(() =>
                      setGameFinal(groupId, g.id, Number(scores[g.id]?.h || 0), Number(scores[g.id]?.a || 0))
                    )
                  }
                >
                  Mark final
                </button>
                {g.status === "final" && (
                  <button
                    className="text-xs text-red-500 hover:text-red-700" disabled={pending}
                    onClick={() => run(() => reopenGame(groupId, g.id))}
                  >
                    Reopen
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Override a pick</h3>
        <p className="mb-3 text-sm text-stone-500">
          Escape hatch for API errors or postponed games — set a member&apos;s
          result directly.
        </p>
        <div className="card divide-y divide-stone-100">
          {members.filter((m) => m.picks.length > 0).length === 0 && (
            <p className="py-2 text-sm text-stone-500">No picks submitted for this week yet.</p>
          )}
          {members.map((m) =>
            m.picks.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="text-stone-400">·</span>
                <span className="font-semibold">{p.teamAbbr}</span>
                <select
                  className="input ml-auto w-32 py-1"
                  defaultValue={p.result}
                  disabled={pending}
                  onChange={(e) =>
                    run(() => overridePick(groupId, p.id, e.target.value as (typeof RESULTS)[number]))
                  }
                >
                  {RESULTS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
