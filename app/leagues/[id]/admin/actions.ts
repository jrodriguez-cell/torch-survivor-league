"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadLeagueContext } from "@/lib/league";

// Guard: throw unless the caller is the league's commissioner.
async function requireCommish(leagueId: string) {
  const ctx = await loadLeagueContext(leagueId);
  if (!ctx.isCommissioner) throw new Error("Commissioner only.");
  return ctx;
}

// ---- Castaways -------------------------------------------------------------
export async function addCastaway(leagueId: string, formData: FormData) {
  const { supabase } = await requireCommish(leagueId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await supabase.from("castaways").insert({
    league_id: leagueId,
    name,
    tribe: String(formData.get("tribe") ?? "").trim() || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function toggleCastawayEliminated(
  leagueId: string,
  castawayId: string,
  eliminate: boolean,
  week: number | null
) {
  const { supabase } = await requireCommish(leagueId);
  await supabase
    .from("castaways")
    .update({
      is_eliminated: eliminate,
      eliminated_week: eliminate ? week : null,
    })
    .eq("id", castawayId)
    .eq("league_id", leagueId);
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function deleteCastaway(leagueId: string, castawayId: string) {
  const { supabase } = await requireCommish(leagueId);
  await supabase.from("castaways").delete().eq("id", castawayId).eq("league_id", leagueId);
  revalidatePath(`/leagues/${leagueId}/admin`);
}

// ---- Episodes --------------------------------------------------------------
export async function addEpisode(leagueId: string, formData: FormData) {
  const { supabase } = await requireCommish(leagueId);
  const week = Number(formData.get("week_number"));
  if (!week || week < 1) return;
  const lockRaw = String(formData.get("picks_lock_at") ?? "").trim();
  await supabase.from("episodes").insert({
    league_id: leagueId,
    week_number: week,
    title: String(formData.get("title") ?? "").trim() || null,
    picks_lock_at: lockRaw ? new Date(lockRaw).toISOString() : null,
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function setEpisodeScored(
  leagueId: string,
  episodeId: string,
  scored: boolean
) {
  const { supabase } = await requireCommish(leagueId);
  await supabase
    .from("episodes")
    .update({ is_scored: scored })
    .eq("id", episodeId)
    .eq("league_id", leagueId);
  revalidatePath(`/leagues/${leagueId}/admin`);
  revalidatePath(`/leagues/${leagueId}`);
}

// ---- Pick'em questions -----------------------------------------------------
export async function addQuestion(
  leagueId: string,
  episodeId: string,
  formData: FormData
) {
  const { supabase } = await requireCommish(leagueId);
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return;
  await supabase.from("pickem_questions").insert({
    league_id: leagueId,
    episode_id: episodeId,
    prompt,
    question_type: String(formData.get("question_type") ?? "castaway"),
    points: Number(formData.get("points") ?? 1) || 1,
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
  });
  revalidatePath(`/leagues/${leagueId}/admin/episodes/${episodeId}`);
}

export async function setQuestionCorrect(
  leagueId: string,
  episodeId: string,
  questionId: string,
  formData: FormData
) {
  const { supabase } = await requireCommish(leagueId);
  const castawayId = String(formData.get("correct_castaway_id") ?? "").trim();
  const text = String(formData.get("correct_text") ?? "").trim();
  await supabase
    .from("pickem_questions")
    .update({
      correct_castaway_id: castawayId || null,
      correct_text: text || null,
    })
    .eq("id", questionId)
    .eq("league_id", leagueId);
  revalidatePath(`/leagues/${leagueId}/admin/episodes/${episodeId}`);
}

export async function deleteQuestion(
  leagueId: string,
  episodeId: string,
  questionId: string
) {
  const { supabase } = await requireCommish(leagueId);
  await supabase.from("pickem_questions").delete().eq("id", questionId).eq("league_id", leagueId);
  revalidatePath(`/leagues/${leagueId}/admin/episodes/${episodeId}`);
}

// ---- Scoring events --------------------------------------------------------
export async function addScoringEvent(
  leagueId: string,
  episodeId: string,
  formData: FormData
) {
  const { supabase } = await requireCommish(leagueId);
  const castawayId = String(formData.get("castaway_id") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim();
  if (!castawayId || !eventType) return;
  await supabase.from("scoring_events").insert({
    league_id: leagueId,
    episode_id: episodeId,
    castaway_id: castawayId,
    event_type: eventType,
    points: Number(formData.get("points") ?? 0) || 0,
  });
  revalidatePath(`/leagues/${leagueId}/admin/episodes/${episodeId}`);
  revalidatePath(`/leagues/${leagueId}`);
}

export async function deleteScoringEvent(
  leagueId: string,
  episodeId: string,
  eventId: string
) {
  const { supabase } = await requireCommish(leagueId);
  await supabase.from("scoring_events").delete().eq("id", eventId).eq("league_id", leagueId);
  revalidatePath(`/leagues/${leagueId}/admin/episodes/${episodeId}`);
  revalidatePath(`/leagues/${leagueId}`);
}
