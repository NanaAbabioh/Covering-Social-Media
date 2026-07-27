import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { runSearchDiscovery } from "@/lib/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual trigger for the search discovery pipeline (used by the "Run discovery
 * now" button in Settings and for local/curl testing). Same secret guard as cron.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSearchDiscovery();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
