import type { SupabaseClient } from "@supabase/supabase-js";
import type { Week } from "@/lib/types";

// The "current" week for a season: the earliest week whose pick deadline is
// still in the future (i.e. the one people are picking now). If every week's
// deadline has passed, fall back to the most recent week.
export async function getCurrentWeek(
  supabase: SupabaseClient,
  season: number
): Promise<Week | null> {
  const nowIso = new Date().toISOString();

  const { data: upcoming } = await supabase
    .from("weeks")
    .select("*")
    .eq("season", season)
    .gte("pick_deadline", nowIso)
    .order("pick_deadline", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (upcoming) return upcoming as Week;

  const { data: latest } = await supabase
    .from("weeks")
    .select("*")
    .eq("season", season)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latest as Week) ?? null;
}

export function deadlinePassed(week: Pick<Week, "pick_deadline">): boolean {
  return new Date(week.pick_deadline).getTime() <= Date.now();
}
