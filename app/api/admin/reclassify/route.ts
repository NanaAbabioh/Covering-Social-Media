import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/settings";
import { classifyVideos } from "@/lib/classify";
import type { Database } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type VideoUpdate = Database["public"]["Tables"]["videos"]["Update"];

/**
 * One-off backlog cleanup: classify every video that hasn't had a human decision
 * yet (status queued/suppressed/maybe — approved/rejected are left untouched),
 * store the content type, then rebuild the review queue from the highest-scoring
 * KEPT videos up to the queue cap. Guarded by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getConfig();

    const { data: rows, error } = await supabase
      .from("videos")
      .select("id, title, description, score, score_signals")
      .in("status", ["queued", "suppressed", "maybe"]);
    if (error) throw new Error(error.message);

    const videos = rows ?? [];
    const { map, errors } = await classifyVideos(
      videos.map((v) => ({
        id: v.id,
        title: v.title ?? "",
        description: v.description ?? "",
      })),
      config.classifier_model
    );

    // Persist classification into each video's score_signals; reset all to
    // suppressed first, then promote the queue below.
    let keptCount = 0;
    for (const v of videos) {
      const c = map.get(v.id);
      const keep = c ? c.keep : true;
      if (keep) keptCount++;
      const signals = {
        ...((v.score_signals as Record<string, unknown>) ?? {}),
        content_type: c?.type ?? "teaching",
        classifier_reason: c?.reason ?? "",
        keep,
      };
      const update: VideoUpdate = {
        status: "suppressed",
        score_signals: signals as unknown as VideoUpdate["score_signals"],
      };
      await supabase.from("videos").update(update).eq("id", v.id);
    }

    // Rebuild the queue: top-scoring kept videos up to the cap.
    const { data: keepers } = await supabase
      .from("videos")
      .select("id")
      .eq("status", "suppressed")
      .eq("score_signals->>keep", "true")
      .order("score", { ascending: false })
      .limit(config.queue_cap);

    const promoteIds = (keepers ?? []).map((k) => k.id);
    if (promoteIds.length > 0) {
      await supabase
        .from("videos")
        .update({ status: "queued" })
        .in("id", promoteIds);
    }

    return NextResponse.json({
      ok: true,
      classified: videos.length,
      kept: keptCount,
      skipped: videos.length - keptCount,
      queued: promoteIds.length,
      classifyErrors: errors,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
