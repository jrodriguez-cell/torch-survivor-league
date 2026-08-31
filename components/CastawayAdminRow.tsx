"use client";

import { useState, useTransition } from "react";
import type { Castaway } from "@/lib/types";
import {
  toggleCastawayEliminated,
  deleteCastaway,
} from "@/app/leagues/[id]/admin/actions";

export default function CastawayAdminRow({
  leagueId,
  castaway,
}: {
  leagueId: string;
  castaway: Castaway;
}) {
  const [week, setWeek] = useState<string>(
    castaway.eliminated_week ? String(castaway.eliminated_week) : ""
  );
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 py-2">
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-stone-200 text-sm">
        {castaway.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={castaway.image_url} alt={castaway.name} className="h-full w-full object-cover" />
        ) : (
          "🏝️"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {castaway.name}{" "}
          {castaway.is_eliminated && (
            <span className="badge bg-red-100 text-red-700">
              Out{castaway.eliminated_week ? ` · Wk ${castaway.eliminated_week}` : ""}
            </span>
          )}
        </div>
        {castaway.tribe && <div className="text-xs text-stone-500">{castaway.tribe}</div>}
      </div>

      <input
        type="number"
        min={1}
        value={week}
        onChange={(e) => setWeek(e.target.value)}
        placeholder="Wk"
        className="input w-16 py-1"
        title="Week eliminated"
      />

      {castaway.is_eliminated ? (
        <button
          className="btn-ghost px-2 py-1 text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              toggleCastawayEliminated(leagueId, castaway.id, false, null)
            )
          }
        >
          Restore
        </button>
      ) : (
        <button
          className="btn-ghost px-2 py-1 text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              toggleCastawayEliminated(
                leagueId,
                castaway.id,
                true,
                week ? Number(week) : null
              )
            )
          }
        >
          Mark out
        </button>
      )}

      <button
        className="px-2 py-1 text-xs text-red-500 hover:text-red-700"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete ${castaway.name}? This also removes them from rosters.`))
            startTransition(() => deleteCastaway(leagueId, castaway.id));
        }}
      >
        Delete
      </button>
    </div>
  );
}
