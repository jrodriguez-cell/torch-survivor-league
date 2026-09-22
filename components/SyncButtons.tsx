"use client";

import { useState, useTransition } from "react";
import { syncScheduleNow, forceResync } from "@/app/groups/[groupId]/settings/actions";

export default function SyncButtons({ groupId }: { groupId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: (g: string) => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn(groupId);
      setMsg(res.message);
    });
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run(syncScheduleNow)}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Working…" : "Load full season schedule"}
        </button>
        <button
          onClick={() => run(forceResync)}
          disabled={pending}
          className="btn-ghost"
        >
          Re-sync scores now
        </button>
      </div>
      {msg && <p className="text-sm text-stone-600">{msg}</p>}
      <p className="text-xs text-stone-400">
        Loading the full season makes the pool roll to the next week on its own
        as each deadline passes. Scores also sync automatically every 10 minutes
        during game windows — use these to force a refresh.
      </p>
    </div>
  );
}
