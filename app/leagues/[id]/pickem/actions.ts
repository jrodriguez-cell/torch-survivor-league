"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadLeagueContext } from "@/lib/league";

type AnswerInput = {
  questionId: string;
  castawayId?: string | null;
  text?: string | null;
};

// Save the current user's pick'em answers for an episode.
// Rejects if the episode's picks_lock_at has already passed.
export async function savePicks(
  leagueId: string,
  episodeId: string,
  answers: AnswerInput[]
): Promise<{ ok: boolean; message?: string }> {
  const { supabase, user } = await loadLeagueContext(leagueId);

  const { data: episode } = await supabase
    .from("episodes")
    .select("picks_lock_at, is_scored")
    .eq("id", episodeId)
    .maybeSingle();

  if (!episode) return { ok: false, message: "Episode not found." };
  if (episode.is_scored) return { ok: false, message: "This week is already scored." };
  if (episode.picks_lock_at && new Date(episode.picks_lock_at) < new Date()) {
    return { ok: false, message: "Picks are locked for this episode." };
  }

  const rows = answers.map((a) => ({
    question_id: a.questionId,
    user_id: user.id,
    answer_castaway_id: a.castawayId ?? null,
    answer_text: a.text ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("pickem_answers")
    .upsert(rows, { onConflict: "question_id,user_id" });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/leagues/${leagueId}/pickem`);
  return { ok: true };
}
