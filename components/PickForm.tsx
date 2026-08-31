"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { NflGame, Team } from "@/lib/types";
import { submitPicks } from "@/app/groups/[groupId]/pick/actions";

function useCountdown(deadlineIso: string) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(deadlineIso).getTime() - now;
  if (ms <= 0) return { text: "Locked", passed: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const text = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s`;
  return { text, passed: false };
}

export default function PickForm({
  groupId,
  weekId,
  deadlineIso,
  picksRequired,
  games,
  teamsById,
  usedTeamIds,
  initialSelected,
}: {
  groupId: string;
  weekId: string;
  deadlineIso: string;
  picksRequired: number;
  games: NflGame[];
  teamsById: Record<string, Team>;
  usedTeamIds: string[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const { text, passed } = useCountdown(deadlineIso);
  const used = useMemo(() => new Set(usedTeamIds), [usedTeamIds]);

  function toggle(teamId: string) {
    if (used.has(teamId) || passed) return;
    setMsg(null);
    setSelected((prev) => {
      if (prev.includes(teamId)) return prev.filter((t) => t !== teamId);
      if (prev.length >= picksRequired) {
        // replace the oldest when picking a new one in a full single-pick week
        if (picksRequired === 1) return [teamId];
        return prev;
      }
      return [...prev, teamId];
    });
  }

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await submitPicks(groupId, weekId, selected);
      setMsg(res.ok ? "Pick saved! 🏈 Good luck." : res.message ?? "Something went wrong.");
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-100 px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold">
            Pick {picksRequired} {picksRequired === 1 ? "team" : "teams"} to win
          </span>
          <span className="text-stone-500"> · selected {selected.length}/{picksRequired}</span>
        </div>
        <div className={`text-sm font-semibold ${passed ? "text-red-600" : "text-jungle-700"}`}>
          {passed ? "🔒 Locked" : `⏳ Locks in ${text}`}
        </div>
      </div>

      <div className="space-y-2">
        {games.map((g) => {
          const away = teamsById[g.away_team_id];
          const home = teamsById[g.home_team_id];
          return (
            <div key={g.id} className="flex items-center gap-2">
              <TeamButton team={away} selected={selected.includes(g.away_team_id)}
                used={used.has(g.away_team_id)} disabled={passed} onClick={() => toggle(g.away_team_id)} />
              <span className="text-xs text-stone-400">@</span>
              <TeamButton team={home} selected={selected.includes(g.home_team_id)}
                used={used.has(g.home_team_id)} disabled={passed} onClick={() => toggle(g.home_team_id)} />
              <span className="ml-auto text-xs text-stone-400">
                {new Date(g.kickoff_time).toLocaleString(undefined, {
                  weekday: "short", hour: "numeric", minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={onSave} disabled={pending || passed} className="btn-primary">
          {pending ? "Saving…" : "Save pick"}
        </button>
        {msg && <span className="text-sm text-stone-600">{msg}</span>}
      </div>
      <p className="mt-3 text-xs text-stone-400">
        Greyed-out teams are ones you&apos;ve already used this season. Teams on a
        bye aren&apos;t shown.
      </p>
    </div>
  );
}

function TeamButton({
  team,
  selected,
  used,
  disabled,
  onClick,
}: {
  team?: Team;
  selected: boolean;
  used: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = team ? team.abbreviation : "—";
  return (
    <button
      onClick={onClick}
      disabled={used || disabled}
      title={team?.name}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
        selected
          ? "border-ember-500 bg-ember-50 text-ember-700 ring-2 ring-ember-200"
          : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
      } ${used ? "cursor-not-allowed opacity-40 line-through" : ""}`}
    >
      {label}
    </button>
  );
}
