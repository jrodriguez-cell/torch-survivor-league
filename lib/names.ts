import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupMember } from "@/lib/types";

// Resolve a display name per group_member. group_members.user_id references
// auth.users (not profiles), so we can't rely on a PostgREST embed — we fetch
// profiles by id and merge, preferring the member's own display_name override.
export async function resolveMemberNames(
  supabase: SupabaseClient,
  members: Pick<GroupMember, "id" | "user_id" | "display_name">[]
): Promise<Record<string, string>> {
  const userIds = [...new Set(members.map((m) => m.user_id))];
  const nameByUser: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      nameByUser[p.id as string] = (p.display_name as string) ?? "Player";
    }
  }

  const out: Record<string, string> = {};
  for (const m of members) {
    out[m.id] = m.display_name || nameByUser[m.user_id] || "Player";
  }
  return out;
}
