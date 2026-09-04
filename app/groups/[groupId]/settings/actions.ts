"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { loadGroupContext } from "@/lib/group";
import { syncSchedule, syncScores } from "@/lib/nfl-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendHtmlEmail, escapeHtml } from "@/lib/email";

async function requireCommish(groupId: string) {
  const ctx = await loadGroupContext(groupId);
  if (!ctx.isCommish) redirect(`/groups/${groupId}`);
  return ctx;
}

// Turn a plain-text message into safe HTML paragraphs (escaped).
function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para.trim()).replaceAll("\n", "<br/>")}</p>`)
    .join("");
}

// Send a free-form announcement to the whole pool (or just the commissioner as
// a test). Commissioner-only.
export async function sendAnnouncement(
  groupId: string,
  subject: string,
  body: string,
  testOnly: boolean
): Promise<{ ok: boolean; message: string }> {
  const { group, user } = await requireCommish(groupId);
  const subj = subject.trim();
  const text = body.trim();
  if (!subj || !text) return { ok: false, message: "Add a subject and a message first." };

  const html = textToHtml(text);
  let recipients: string[];

  if (testOnly) {
    if (!user.email) return { ok: false, message: "Your account has no email address." };
    recipients = [user.email];
  } else {
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("group_members").select("user_id").eq("group_id", group.id);
    recipients = [];
    for (const m of members ?? []) {
      const { data } = await admin.auth.admin.getUserById(m.user_id as string);
      if (data.user?.email) recipients.push(data.user.email);
    }
    if (!recipients.length) return { ok: false, message: "No recipient emails found." };
  }

  const ok = await sendHtmlEmail(recipients, testOnly ? `[TEST] ${subj}` : subj, html);
  if (!ok) {
    return { ok: false, message: "Email isn't configured (set RESEND_API_KEY) or the send failed." };
  }
  return testOnly
    ? { ok: true, message: `Test sent to ${user.email}. Check your inbox.` }
    : { ok: true, message: `Announcement sent to ${recipients.length} player(s).` };
}

// Pull this week's real schedule from ESPN into the DB (replaces test data).
export async function syncScheduleNow(
  groupId: string
): Promise<{ ok: boolean; message: string }> {
  await requireCommish(groupId);
  try {
    const r = await syncSchedule();
    revalidatePath(`/groups/${groupId}/pick`);
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, message: `Loaded ${r.games} games for Week ${r.weekNumber} (${r.season}).` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
}

// Force a live score sync + re-scoring right now.
export async function forceResync(
  groupId: string
): Promise<{ ok: boolean; message: string }> {
  await requireCommish(groupId);
  try {
    const r = await syncScores();
    revalidatePath(`/groups/${groupId}/standings`);
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/pick`);
    return { ok: true, message: `Synced Week ${r.weekNumber} scores and updated standings.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
}

export async function updateGroupSettings(groupId: string, formData: FormData) {
  const { supabase } = await requireCommish(groupId);
  const name = String(formData.get("name") ?? "").trim();
  const strikeLimit = Math.max(1, Math.min(2, Number(formData.get("strike_limit") ?? 1)));
  const isPublic = formData.get("is_public") === "on";
  if (!name) return;

  await supabase
    .from("groups")
    .update({ name, strike_limit: strikeLimit, is_public: isPublic })
    .eq("id", groupId);

  revalidatePath(`/groups/${groupId}/settings`);
  revalidatePath(`/groups/${groupId}`);
}

export async function regenerateInviteCode(groupId: string) {
  const { supabase } = await requireCommish(groupId);
  const code = randomBytes(4).toString("hex").toUpperCase(); // 8 hex chars
  await supabase.from("groups").update({ invite_code: code }).eq("id", groupId);
  revalidatePath(`/groups/${groupId}/settings`);
  revalidatePath(`/groups/${groupId}`);
}

export async function removeMember(groupId: string, memberId: string) {
  const { supabase, group } = await requireCommish(groupId);
  // Never let the commissioner remove themselves (would orphan the group).
  const { data: target } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (target?.user_id === group.commish_id) return;

  await supabase.from("group_members").delete().eq("id", memberId).eq("group_id", groupId);
  revalidatePath(`/groups/${groupId}/settings`);
  revalidatePath(`/groups/${groupId}`);
}
