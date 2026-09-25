"use client";

import { useMemo, useState, useTransition } from "react";
import { commishSetOwnPick } from "@/app/groups/[groupId]/scoring/actions";

type TeamOpt = { id: string; abbr: string; opp: string };
export type CommishWeek = {
  id: string;
  number: number;
  picksRequired: number;
  deadlinePassed: boolean;
  teams: TeamOpt[];
  myPickTeamIds: string[];
};

export default function CommishSelfPick({
  groupId,
  weeks,
  usedTeamIds,
}: {
  groupId: string;
  weeks: CommishWeek[];
  usedTeamIds: string[]; // teams the commissioner has used across ALL weeks
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  // Default to the most recent week whose deadline has passed (the usual reason
  // to reach for this tool), else the first week.
  const defaultWeekId =
    [...weeks].reverse().find((w) => w.deadlinePassed)?.id ?? weeks[0]?.id ?? "";
  const [weekId, setWeekId] = useState(defaultWeekId);
  const [selected, setSelected] = useState<string[]>(
    () => weeks.find((w) => w.id === defaultWeekId)?.myPickTeamIds ?? []
  );

  const week = useMemo(() => weeks.find((w) => w.id === weekId), [weeks, weekId]);

  // Teams used in OTHER weeks are off-limits (survivor rule); a team already
  // picked for THIS week stays selectable so you can keep or change it.
  const blocked = useMemo(() => {
    const thisWeek = new Set(week?.myPickTeamIds ?? []);
    return new Set(usedTeamIds.filter((t) => !thisWeek.has(t)));
  }, [usedTeamIds, week]);

  function onWeekChange(id: string) {
    setWeekId(id);
    setSelected(weeks.find((w) => w.id === id)?.myPickTeamIds ?? []);
    setMsg(null);
  }

  function toggle(teamId: string) {
    if (blocked.has(teamId)) return;
    const need = week?.picksRequired ?? 1;
    setSelected((cur) => {
      if (cur.includes(teamId)) return cur.filter((t) => t !== teamId);
      if (need === 1) return [teamId];
      if (cur.length >= need) return [...cur.slice(1), teamId]; // keep last `need`
      return [...cur, teamId];
    });
  }

  function submit() {
    if (!week) return;
    setMsg(null);
    startTransition(async () => {
      const res = await commishSetOwnPick(groupId, week.id, selected);
      setMsg(res.message);
    });
  }

  if (!weeks.length) return null;

  return (
    <section className="card">
      <h3 className="font-semibold">Make my pick (commissioner override)</h3>
      <p className="mb-3 text-sm text-stone-500">
        Place or change <strong>your own</strong> pick for any week — even one
        that&apos;s locked. This only affects your pick; everyone else&apos;s
        stays exactly as submitted, and the week is not reopened for the pool.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <label className="label" htmlFor="commish_week">Week</label>
        <select
          id="commish_week"
          className="input w-40 py-1"
          value={weekId}
          onChange={(e) => onWeekChange(e.target.value)}
          disabled={pending}
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              Week {w.number}
              {w.deadlinePassed ? " (locked)" : ""}
            </option>
          ))}
        </select>
      </div>

      {week && week.teams.length === 0 && (
        <p className="text-sm text-stone-500">No games loaded for this week yet.</p>
      )}

      {week && week.teams.length > 0 && (
        <>
          <p className="mb-2 text-xs text-stone-400">
            Pick {week.picksRequired} team{week.picksRequired === 1 ? "" : "s"}.
            Dimmed teams are ones you&apos;ve already used this season.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {week.teams.map((t) => {
              const isSel = selected.includes(t.id);
              const isBlocked = blocked.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={pending || isBlocked}
                  onClick={() => toggle(t.id)}
                  className={
                    "rounded-lg border px-3 py-2 text-left text-sm transition " +
                    (isSel
                      ? "border-stone-800 bg-stone-800 text-white"
                      : isBlocked
                      ? "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-300"
                      : "border-stone-200 hover:border-stone-400")
                  }
                >
                  <span className="font-semibold">{t.abbr}</span>
                  <span className={isSel ? "text-stone-300" : "text-stone-400"}> {t.opp}</span>
                </button>
              );
            })}
          </div>
          <button
            className="btn-primary"
            disabled={pending || selected.length !== week.picksRequired}
            onClick={submit}
          >
            {pending ? "Saving…" : `Save my Week ${week.number} pick`}
          </button>
        </>
      )}

      {msg && <p className="mt-3 text-sm text-stone-600">{msg}</p>}
    </section>
  );
}
