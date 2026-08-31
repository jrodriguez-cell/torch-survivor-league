import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { League } from "@/lib/types";

// Loads the current user, the league, and the user's role in it.
// Redirects to /login if signed out, or /dashboard if not a member.
export async function loadLeagueContext(leagueId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) redirect("/dashboard");

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/dashboard");

  const isCommissioner =
    membership.role === "commissioner" ||
    (league as League).commissioner_id === user.id;

  return { supabase, user, league: league as League, isCommissioner };
}
