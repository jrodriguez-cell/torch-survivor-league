"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Create a new league; the creator becomes commissioner and a member.
export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const seasonName = String(formData.get("season_name") ?? "").trim() || "Season";
  const rosterSize = Math.max(1, Math.min(10, Number(formData.get("roster_size") ?? 4)));

  if (!name) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league, error } = await supabase
    .from("leagues")
    .insert({
      name,
      season_name: seasonName,
      roster_size: rosterSize,
      commissioner_id: user.id,
    })
    .select("id")
    .single();

  if (error || !league) {
    throw new Error(error?.message ?? "Could not create league");
  }

  await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "commissioner",
  });

  revalidatePath("/dashboard");
  redirect(`/leagues/${league.id}`);
}

// Join an existing league by its invite code.
export async function joinLeague(formData: FormData) {
  const code = String(formData.get("invite_code") ?? "").trim().toUpperCase();
  if (!code) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();

  if (!league) {
    redirect("/dashboard?error=notfound");
  }

  await supabase
    .from("league_members")
    .upsert(
      { league_id: league.id, user_id: user.id, role: "member" },
      { onConflict: "league_id,user_id", ignoreDuplicates: true }
    );

  revalidatePath("/dashboard");
  redirect(`/leagues/${league.id}`);
}
