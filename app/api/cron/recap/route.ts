import { NextResponse } from "next/server";
import { sendDueRecaps } from "@/lib/recap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Weekly automated recap. Called by Vercel Cron (Tuesday, after MNF). Verifies
// CRON_SECRET, then emails each pool the recap for its most recently completed
// week (deduped so a week is sent at most once).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const result = await sendDueRecaps();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "recap failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
