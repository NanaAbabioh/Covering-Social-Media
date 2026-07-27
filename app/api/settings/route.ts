import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig, type AppConfig } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update the app config (queue cap, lookback, scoring weights/thresholds). */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const current = await getConfig();

  const next: AppConfig = {
    ...current,
    queue_cap:
      typeof body.queue_cap === "number" ? body.queue_cap : current.queue_cap,
    lookback_days:
      typeof body.lookback_days === "number"
        ? body.lookback_days
        : current.lookback_days,
    classifier_model:
      typeof body.classifier_model === "string" && body.classifier_model.trim()
        ? body.classifier_model.trim()
        : current.classifier_model,
    weights: { ...current.weights, ...(body.weights ?? {}) },
    thresholds: { ...current.thresholds, ...(body.thresholds ?? {}) },
  };

  try {
    await saveConfig(next);
    return NextResponse.json({ ok: true, config: next });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
