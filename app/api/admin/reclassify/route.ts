import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { reclassifyBacklog } from "@/lib/reclassify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-off backlog cleanup: classify every undecided video and rebuild the queue
 * from the highest-scoring kept ones. Guarded by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await reclassifyBacklog();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
