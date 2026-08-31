"use client";

import { useState } from "react";
import type { Castaway } from "@/lib/types";
import { DEFAULT_SCORING } from "@/lib/types";
import { addScoringEvent } from "@/app/leagues/[id]/admin/actions";

export default function ScoringEventForm({
  leagueId,
  episodeId,
  castaways,
}: {
  leagueId: string;
  episodeId: string;
  castaways: Castaway[];
}) {
  const [eventType, setEventType] = useState(DEFAULT_SCORING[0].event_type);
  const [points, setPoints] = useState<number>(DEFAULT_SCORING[0].points);

  function onEventChange(value: string) {
    setEventType(value);
    const preset = DEFAULT_SCORING.find((d) => d.event_type === value);
    if (preset) setPoints(preset.points);
  }

  const action = addScoringEvent.bind(null, leagueId, episodeId);

  return (
    <form action={action} className="card space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select name="castaway_id" required className="input">
          <option value="">Choose castaway…</option>
          {castaways.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="event_type"
          value={eventType}
          onChange={(e) => onEventChange(e.target.value)}
          className="input"
        >
          {DEFAULT_SCORING.map((d) => (
            <option key={d.event_type} value={d.event_type}>
              {d.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-stone-600">Points</label>
        <input
          name="points"
          type="number"
          step="0.5"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="input w-24"
        />
        <button className="btn-primary ml-auto">Add points</button>
      </div>
      {eventType === "custom" && (
        <p className="text-xs text-stone-400">
          Tip: for a custom event, the label saved is &quot;custom&quot;. You can
          rename by editing the database, or just use it as a points adjustment.
        </p>
      )}
    </form>
  );
}
