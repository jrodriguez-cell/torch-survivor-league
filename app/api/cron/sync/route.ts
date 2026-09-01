import { NextResponse } from "next/server";
import { syncScores } from "@/lib/nfl-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Live score sync + scoring. Called by Vercel Cron every 10 minutes.
// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the
// CRON_SECRET env var is set, so we verify that before doing any work.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const summary = await syncScores();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
