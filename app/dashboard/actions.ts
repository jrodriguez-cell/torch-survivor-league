"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/types";

// Create a new group; the creator becomes commissioner and first member.
export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const strikeLimit = Math.max(1, Math.min(3, Number(formData.get("strike_limit") ?? 1)));
  const isPublic = formData.get("is_public") === "on";
  if (!name) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group, error } = await supabase
    .from("groups")
    .insert({
      name,
      commish_id: user.id,
      strike_limit: strikeLimit,
      is_public: isPublic,
      season: CURRENT_SEASON,
    })
    .select("id")
    .single();

  if (error || !group) {
    throw new Error(error?.message ?? "Could not create group");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    display_name: profile?.display_name ?? null,
  });

  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}

// Join a group by its invite code (via the security-definer RPC).
export async function joinByCode(formData: FormData) {
  const code = String(formData.get("invite_code") ?? "").trim().toUpperCase();
  if (!code) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: groupId, error } = await supabase.rpc("join_group_by_code", {
    p_code: code,
  });

  if (error || !groupId) {
    redirect("/dashboard?error=badcode");
  }

  revalidatePath("/dashboard");
  redirect(`/groups/${groupId}`);
}
