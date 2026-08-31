"use client";

import { useState, useTransition } from "react";
import type { Castaway } from "@/lib/types";
import { saveRoster } from "@/app/leagues/[id]/roster/actions";

export default function RosterEditor({
  leagueId,
  rosterSize,
  castaways,
  initialSelected,
}: {
  leagueId: string;
  rosterSize: number;
  castaways: Castaway[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(id: string) {
    setMsg(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < rosterSize) next.add(id);
      return next;
    });
  }

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveRoster(leagueId, [...selected]);
      setMsg(res.ok ? "Saved! 🔥" : res.message ?? "Something went wrong.");
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          Picked <strong>{selected.size}</strong> of {rosterSize}
        </p>
        <button onClick={onSave} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save my team"}
        </button>
      </div>

      {msg && (
        <p className="mb-4 rounded-lg bg-stone-100 p-2 text-sm text-stone-700">{msg}</p>
      )}

      {castaways.length === 0 ? (
        <p className="text-stone-500">
          No castaways have been added yet. Ask your commissioner to add the
          season&apos;s cast.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {castaways.map((c) => {
            const isPicked = selected.has(c.id);
            const disabled =
              !isPicked && selected.size >= rosterSize;
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                disabled={disabled || c.is_eliminated}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  isPicked
                    ? "border-ember-500 bg-ember-50 ring-2 ring-ember-200"
                    : "border-stone-200 bg-white hover:border-stone-300"
                } ${disabled || c.is_eliminated ? "opacity-50" : ""}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200 text-lg">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>🏝️</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-xs text-stone-500">
                    {c.is_eliminated ? "Eliminated" : c.tribe ?? " "}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
