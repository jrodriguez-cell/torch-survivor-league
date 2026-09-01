import { NextResponse } from "next/server";
import { sendDeadlineReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Deadline reminder emails. Called daily by Vercel Cron. Verifies CRON_SECRET.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const result = await sendDeadlineReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "reminders failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
