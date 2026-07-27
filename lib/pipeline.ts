import "server-only";
import { supabase } from "./supabase";
import { getVideos, getChannels, channelUrl } from "./youtube";
import { scoreVideo } from "./scoring";
import { getConfig } from "./settings";
import { classifyVideos, KEEP_TYPES } from "./classify";
import type { Database } from "./types";

type VideoInsert = Database["public"]["Tables"]["videos"]["Insert"];
type ChannelInsert = Database["public"]["Tables"]["channels"]["Insert"];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Top the review queue back up to the configured cap after a video leaves it
 * (rejected/approved/maybe). Promotes the highest-scoring SUPPRESSED videos
 * that the classifier kept (or that predate classification) into the queue.
 */
export async function backfillQueue(): Promise<number> {
  const config = await getConfig();

  const { count: queuedCount } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  const slots = Math.max(0, config.queue_cap - (queuedCount ?? 0));
  if (slots === 0) return 0;

  // Eligible = suppressed AND not explicitly classified as skip (keep != false).
  // Includes rows predating classification (keep is null).
  const { data: candidates, error } = await supabase
    .from("videos")
    .select("id")
    .eq("status", "suppressed")
    .or("score_signals->>keep.is.null,score_signals->>keep.eq.true")
    .order("score", { ascending: false })
    .limit(slots);

  if (error || !candidates || candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);
  const { error: upErr } = await supabase
    .from("videos")
    .update({ status: "queued" })
    .in("id", ids);
  if (upErr) return 0;
  return ids.length;
}

/** Return only the IDs not already present in the videos table. */
async function filterNewVideoIds(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids));
  const existing = new Set<string>();
  for (const batch of chunk(unique, 150)) {
    const { data, error } = await supabase
      .from("videos")
      .select("id")
      .in("id", batch);
    if (error) throw new Error(`dedupe query failed: ${error.message}`);
    for (const row of data ?? []) existing.add(row.id);
  }
  return unique.filter((id) => !existing.has(id));
}

export type PipelineSummary = {
  source: "search" | "rss";
  candidateIds: number;
  newIds: number;
  inserted: number;
  queued: number;
  suppressed: number;
  skippedByType: number;
  errors: string[];
};

/**
 * Core discovery pipeline shared by the search cron and the RSS cron:
 * dedupe -> fetch video + channel details -> score -> upsert channels ->
 * insert videos with queue-cap-aware status.
 */
export async function processVideoIds(
  candidateIds: string[],
  source: "search" | "rss"
): Promise<PipelineSummary> {
  const errors: string[] = [];
  const summary: PipelineSummary = {
    source,
    candidateIds: candidateIds.length,
    newIds: 0,
    inserted: 0,
    queued: 0,
    suppressed: 0,
    skippedByType: 0,
    errors,
  };

  const config = await getConfig();

  const newIds = await filterNewVideoIds(candidateIds);
  summary.newIds = newIds.length;
  if (newIds.length === 0) return summary;

  // Fetch details.
  const videos = await getVideos(newIds);
  const channelIds = Array.from(new Set(videos.map((v) => v.snippet.channelId)));
  const channels = await getChannels(channelIds);
  const channelById = new Map(channels.map((c) => [c.id, c]));

  // Classify content TYPE (teaching/testimony vs spoken-prayer/worship/AI).
  // Videos that aren't the kind we want never reach the review queue.
  const { map: classifications, errors: classifyErrors } = await classifyVideos(
    videos.map((v) => ({
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
    })),
    config.classifier_model
  );
  for (const e of classifyErrors) errors.push(`classify: ${e}`);

  // Score every video and build channel upsert payloads (stats only — never
  // touch status/rss_monitored so approved channels aren't downgraded).
  const channelPayloads = new Map<string, ChannelInsert>();
  const scored: { row: VideoInsert; score: number; keep: boolean }[] = [];

  const now = new Date();
  for (const v of videos) {
    const channel = channelById.get(v.snippet.channelId);
    const result = scoreVideo({ video: v, channel, config, now });
    const classification = classifications.get(v.id);
    const keep = classification ? classification.keep : true;
    if (!keep) summary.skippedByType++;

    if (channel) {
      channelPayloads.set(channel.id, {
        id: channel.id,
        name: channel.snippet.title,
        url: channelUrl(channel.id),
        subscriber_count: channel.statistics.subscriberCount
          ? Number(channel.statistics.subscriberCount)
          : null,
        video_count: channel.statistics.videoCount
          ? Number(channel.statistics.videoCount)
          : null,
        channel_published_at: channel.snippet.publishedAt,
        upload_frequency: result.uploadsPerWeek,
        website: result.website,
      });
    }

    const signalsWithType = {
      ...result.signals,
      content_type: classification?.type ?? "teaching",
      classifier_reason: classification?.reason ?? "",
      keep,
    };

    scored.push({
      score: result.score,
      keep,
      row: {
        id: v.id,
        channel_id: v.snippet.channelId,
        title: v.snippet.title,
        description: v.snippet.description,
        published_at: v.snippet.publishedAt,
        duration: v.contentDetails?.duration ?? null,
        view_count: v.statistics.viewCount ? Number(v.statistics.viewCount) : null,
        comment_count: v.statistics.commentCount
          ? Number(v.statistics.commentCount)
          : null,
        discovery_source: source,
        score: result.score,
        score_signals: signalsWithType as unknown as Database["public"]["Tables"]["videos"]["Insert"]["score_signals"],
        status: "suppressed", // overwritten below for queued winners
      },
    });
  }

  // Upsert channels (stats only). New channels default to status='candidate'.
  if (channelPayloads.size > 0) {
    const { error } = await supabase
      .from("channels")
      .upsert(Array.from(channelPayloads.values()), { onConflict: "id" });
    if (error) errors.push(`channel upsert: ${error.message}`);
  }

  // Queue cap: fill remaining review-queue slots with the highest-scoring
  // KEPT videos only. Skip-type videos stay suppressed regardless of score.
  const { count: queuedCount } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");
  const slots = Math.max(0, config.queue_cap - (queuedCount ?? 0));

  const keepers = scored.filter((s) => s.keep).sort((a, b) => b.score - a.score);
  keepers.forEach((item, i) => {
    item.row.status = i < slots ? "queued" : "suppressed";
  });
  summary.queued = keepers.filter((k) => k.row.status === "queued").length;
  summary.suppressed = scored.length - summary.queued;

  // Insert videos (ignore any that raced in).
  const rows = scored.map((s) => s.row);
  for (const batch of chunk(rows, 200)) {
    const { data, error } = await supabase
      .from("videos")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      errors.push(`video insert: ${error.message}`);
    } else {
      summary.inserted += data?.length ?? 0;
    }
  }

  return summary;
}
