import "server-only";
import { supabase } from "./supabase";
import { getConfig } from "./settings";
import { classifyVideos } from "./classify";
import type { Database } from "./types";

type VideoUpdate = Database["public"]["Tables"]["videos"]["Update"];

export type ReclassifySummary = {
  classified: number;
  kept: number;
  skipped: number;
  queued: number;
  errors: string[];
};

/**
 * Classify every video that hasn't had a human decision yet (status
 * queued/suppressed/maybe — approved/rejected are left untouched), store the
 * content type on each, then rebuild the review queue from the highest-scoring
 * KEPT videos up to the queue cap.
 */
export async function reclassifyBacklog(): Promise<ReclassifySummary> {
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

  return {
    classified: videos.length,
    kept: keptCount,
    skipped: videos.length - keptCount,
    queued: promoteIds.length,
    errors,
  };
}
