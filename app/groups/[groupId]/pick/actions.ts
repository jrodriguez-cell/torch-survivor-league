"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadGroupContext } from "@/lib/group";
import { deadlinePassed } from "@/lib/week";
import type { NflGame, Week } from "@/lib/types";

// Submit (or replace) the current user's pick(s) for a week. Enforces the
// deadline, the required pick count, that each team plays that week, and the
// no-repeat rule — with the DB trigger + unique indexes as a backstop.
export async function submitPicks(
  groupId: string,
  weekId: string,
  teamIds: string[]
): Promise<{ ok: boolean; message?: string }> {
  const { supabase, membership } = await loadGroupContext(groupId);

  if (membership.status !== "active") {
    return { ok: false, message: "You've been eliminated — no more picks." };
  }

  const { data: weekData } = await supabase
    .from("weeks")
    .select("*")
    .eq("id", weekId)
    .maybeSingle();
  const week = weekData as Week | null;
  if (!week) return { ok: false, message: "Week not found." };
  if (deadlinePassed(week)) {
    return { ok: false, message: "Picks are locked for this week." };
  }

  const unique = [...new Set(teamIds.filter(Boolean))];
  if (unique.length !== week.picks_required) {
    return {
      ok: false,
      message: `Pick exactly ${week.picks_required} ${
        week.picks_required === 1 ? "team" : "different teams"
      } this week.`,
    };
  }

  // Teams must be playing this week.
  const { data: gameData } = await supabase
    .from("nfl_games")
    .select("*")
    .eq("week_id", weekId);
  const games = (gameData as NflGame[]) ?? [];
  const playing = new Set<string>();
  games.forEach((g) => {
    playing.add(g.home_team_id);
    playing.add(g.away_team_id);
  });
  for (const t of unique) {
    if (!playing.has(t)) {
      return { ok: false, message: "One of those teams isn't playing this week." };
    }
  }

  // No repeating a team used in a different week this season.
  const { data: priorPicks } = await supabase
    .from("picks")
    .select("team_id, week_id")
    .eq("group_member_id", membership.id)
    .neq("week_id", weekId);
  const used = new Set((priorPicks ?? []).map((p) => p.team_id as string));
  for (const t of unique) {
    if (used.has(t)) {
      return { ok: false, message: "You've already used one of those teams this season." };
    }
  }

  // Replace this week's picks with the new selection.
  await supabase
    .from("picks")
    .delete()
    .eq("group_member_id", membership.id)
    .eq("week_id", weekId);

  const rows = unique.map((teamId) => ({
    group_member_id: membership.id,
    week_id: weekId,
    team_id: teamId,
    locked_at: null,
  }));
  const { error } = await supabase.from("picks").insert(rows);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/groups/${groupId}/pick`);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/standings`);
  revalidatePath(`/groups/${groupId}/history`);
  return { ok: true };
}
