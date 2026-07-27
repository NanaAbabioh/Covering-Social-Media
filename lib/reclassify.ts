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

type Row = {
  id: string;
  title: string | null;
  description: string | null;
  score: number | null;
  score_signals: unknown;
};

/** Fetch every undecided video (status queued/suppressed/maybe), paginating past
 *  PostgREST's 1000-row default so nothing is left with a stale classification. */
async function fetchUndecided(): Promise<Row[]> {
  const pageSize = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("videos")
      .select("id, title, description, score, score_signals")
      .in("status", ["queued", "suppressed", "maybe"])
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    await worker(items[i]);
    await next();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next())
  );
}

/**
 * Classify every undecided video with the current (strict) classifier, store the
 * content type, then rebuild the review queue from the highest-scoring KEPT
 * videos up to the cap. Approved/rejected videos are never touched.
 */
export async function reclassifyBacklog(): Promise<ReclassifySummary> {
  const config = await getConfig();
  const videos = await fetchUndecided();

  const { map, errors } = await classifyVideos(
    videos.map((v) => ({
      id: v.id,
      title: v.title ?? "",
      description: v.description ?? "",
    })),
    config.classifier_model
  );

  let keptCount = 0;
  await runPool(videos, 12, async (v) => {
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
  });

  // Rebuild the queue: highest-scoring kept videos up to the cap.
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
