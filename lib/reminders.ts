import { createAdminClient } from "@/lib/supabase/admin";
import { sendReminderEmail } from "@/lib/email";

// Email active members who still haven't completed their pick for a week whose
// deadline is within the next 48 hours. Deduped via group_members.reminded_week_id
// so each member is nudged at most once per week. No-op without email configured.
export async function sendDeadlineReminders(): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const soonIso = new Date(now + 48 * 3600 * 1000).toISOString();

  const { data: weeks } = await admin
    .from("weeks")
    .select("id, season, pick_deadline, picks_required")
    .gt("pick_deadline", nowIso)
    .lte("pick_deadline", soonIso);

  let sent = 0;
  for (const w of weeks ?? []) {
    const { data: groups } = await admin
      .from("groups").select("id, name").eq("season", w.season);

    for (const g of groups ?? []) {
      const { data: members } = await admin
        .from("group_members")
        .select("id, user_id, reminded_week_id")
        .eq("group_id", g.id)
        .eq("status", "active");

      for (const m of members ?? []) {
        if (m.reminded_week_id === w.id) continue;

        const { count } = await admin
          .from("picks")
          .select("id", { count: "exact", head: true })
          .eq("group_member_id", m.id)
          .eq("week_id", w.id);
        if ((count ?? 0) >= (w.picks_required as number)) continue; // already picked

        const { data: u } = await admin.auth.admin.getUserById(m.user_id as string);
        const email = u.user?.email;
        if (email) {
          const ok = await sendReminderEmail(email, g.name as string, w.pick_deadline as string);
          if (ok) {
            sent++;
            await admin.from("group_members").update({ reminded_week_id: w.id }).eq("id", m.id);
          }
        }
      }
    }
  }

  return { sent };
}
