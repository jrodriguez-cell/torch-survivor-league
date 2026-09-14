"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadGroupContext } from "@/lib/group";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescoreSeason, syncScores } from "@/lib/nfl-sync";
import { buildRecap } from "@/lib/recap";
import { sendHtmlEmail } from "@/lib/email";
import type { NflGame, Week } from "@/lib/types";

async function requireCommish(groupId: string) {
  const ctx = await loadGroupContext(groupId);
  if (!ctx.isCommish) redirect(`/groups/${groupId}`);
  return ctx;
}

function revalidateGroup(groupId: string) {
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/standings`);
  revalidatePath(`/groups/${groupId}/pick`);
  revalidatePath(`/groups/${groupId}/history`);
  revalidatePath(`/groups/${groupId}/scoring`);
}

// Mark a game final with a score; winner is inferred (tie if equal). Then
// re-resolve picks and recompute strikes/eliminations.
export async function setGameFinal(
  groupId: string,
  gameId: string,
  homeScore: number,
  awayScore: number
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: g } = await admin.from("nfl_games").select("*").eq("id", gameId).maybeSingle();
  const game = g as NflGame | null;
  if (!game) return { ok: false, message: "Game not found." };

  const winnerTeamId =
    homeScore > awayScore ? game.home_team_id : awayScore > homeScore ? game.away_team_id : null;

  await admin
    .from("nfl_games")
    .update({
      status: "final",
      home_score: homeScore,
      away_score: awayScore,
      winner_team_id: winnerTeamId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return {
    ok: true,
    message: winnerTeamId ? "Marked final; picks resolved." : "Marked final (tie); picks resolved.",
  };
}

// Undo a final result: back to scheduled, reset its picks to pending, clear the
// week's strikes, and recompute (strikes re-derive from whatever's still final).
export async function reopenGame(
  groupId: string,
  gameId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: g } = await admin.from("nfl_games").select("*").eq("id", gameId).maybeSingle();
  const game = g as NflGame | null;
  if (!game) return { ok: false, message: "Game not found." };

  await admin
    .from("nfl_games")
    .update({ status: "scheduled", home_score: null, away_score: null, winner_team_id: null })
    .eq("id", gameId);
  await admin
    .from("picks")
    .update({ result: "pending" })
    .eq("week_id", game.week_id)
    .in("team_id", [game.home_team_id, game.away_team_id]);
  await admin.from("member_strikes").delete().eq("week_id", game.week_id);

  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: "Game reopened; results reset." };
}

// Directly override one member's pick result (API-hiccup escape hatch).
export async function overridePick(
  groupId: string,
  pickId: string,
  result: "pending" | "win" | "loss" | "tie" | "missed"
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  await admin.from("picks").update({ result }).eq("id", pickId);
  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: `Pick set to ${result}.` };
}

// Send the AI-written weekly recap to everyone in the pool.
export async function sendRecap(
  groupId: string,
  weekId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: w } = await admin.from("weeks").select("*").eq("id", weekId).maybeSingle();
  const week = w as Week | null;
  if (!week) return { ok: false, message: "Week not found." };

  const { data: members } = await admin
    .from("group_members").select("user_id").eq("group_id", group.id);
  const emails: string[] = [];
  for (const m of members ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.user_id as string);
    if (data.user?.email) emails.push(data.user.email);
  }
  if (!emails.length) return { ok: false, message: "No recipient emails found." };

  // Refresh scores + resolve picks so the recap reflects current results.
  try { await syncScores(); } catch { /* send with best-available data */ }
  const { subject, html } = await buildRecap(admin, group, week);
  const ok = await sendHtmlEmail(emails, subject, html);
  return ok
    ? { ok: true, message: `Recap sent to ${emails.length} player(s).` }
    : { ok: false, message: "Email isn't configured (set RESEND_API_KEY) or the send failed." };
}

// Send a test recap to just the commissioner (to confirm email works).
export async function sendTestRecap(
  groupId: string,
  weekId: string
): Promise<{ ok: boolean; message: string }> {
  const { group, user } = await requireCommish(groupId);
  const admin = createAdminClient();

  const { data: w } = await admin.from("weeks").select("*").eq("id", weekId).maybeSingle();
  const week = w as Week | null;
  if (!week) return { ok: false, message: "Week not found." };
  if (!user.email) return { ok: false, message: "Your account has no email address." };

  // Refresh scores + resolve picks so the test reflects current results.
  try { await syncScores(); } catch { /* send with best-available data */ }
  const { subject, html } = await buildRecap(admin, group, week);
  const ok = await sendHtmlEmail(user.email, `[TEST] ${subject}`, html);
  return ok
    ? { ok: true, message: `Test recap sent to ${user.email}. Check your inbox.` }
    : { ok: false, message: "Email isn't configured (set RESEND_API_KEY) or the send failed." };
}

// Lock a week's picks immediately (emergencies / testing). Re-syncing the
// schedule restores the real kickoff-based deadline.
export async function lockWeekNow(
  groupId: string,
  weekId: string
): Promise<{ ok: boolean; message: string }> {
  const { group } = await requireCommish(groupId);
  const admin = createAdminClient();

  await admin.from("weeks").update({ pick_deadline: new Date().toISOString() }).eq("id", weekId);
  await rescoreSeason(group.season);
  revalidateGroup(groupId);
  return { ok: true, message: "Picks locked for this week." };
}
