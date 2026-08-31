"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { loadGroupContext } from "@/lib/group";

async function requireCommish(groupId: string) {
  const ctx = await loadGroupContext(groupId);
  if (!ctx.isCommish) redirect(`/groups/${groupId}`);
  return ctx;
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
