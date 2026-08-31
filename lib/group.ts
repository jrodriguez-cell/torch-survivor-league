import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Group, GroupMember } from "@/lib/types";

// Loads the current user, a group, and the user's membership + role in it.
// Redirects to /login if signed out, or /dashboard if not a member.
export async function loadGroupContext(groupId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) redirect("/dashboard");

  const { data: membership } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/dashboard");

  const isCommish = (group as Group).commish_id === user.id;

  return {
    supabase,
    user,
    group: group as Group,
    membership: membership as GroupMember,
    isCommish,
  };
}
