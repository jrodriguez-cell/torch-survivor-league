"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadLeagueContext } from "@/lib/league";

// Replace the current user's roster with the selected castaways.
export async function saveRoster(
  leagueId: string,
  castawayIds: string[]
): Promise<{ ok: boolean; message?: string }> {
  const { supabase, user, league } = await loadLeagueContext(leagueId);

  if (castawayIds.length > league.roster_size) {
    return {
      ok: false,
      message: `You can pick at most ${league.roster_size} castaways.`,
    };
  }

  // Ensure a roster row exists for this member.
  const { data: roster, error: rErr } = await supabase
    .from("rosters")
    .upsert(
      { league_id: leagueId, user_id: user.id },
      { onConflict: "league_id,user_id" }
    )
    .select("id")
    .single();

  if (rErr || !roster) {
    return { ok: false, message: rErr?.message ?? "Could not save roster." };
  }

  // Reset picks, then insert the new selection.
  await supabase.from("roster_castaways").delete().eq("roster_id", roster.id);

  if (castawayIds.length > 0) {
    const rows = castawayIds.map((cid) => ({
      roster_id: roster.id,
      castaway_id: cid,
    }));
    const { error: iErr } = await supabase.from("roster_castaways").insert(rows);
    if (iErr) return { ok: false, message: iErr.message };
  }

  revalidatePath(`/leagues/${leagueId}/roster`);
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
