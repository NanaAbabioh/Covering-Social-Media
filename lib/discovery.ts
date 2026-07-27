import "server-only";
import { supabase } from "./supabase";
import { searchVideos } from "./youtube";
import { getConfig } from "./settings";
import { processVideoIds, type PipelineSummary } from "./pipeline";
import { fetchChannelFeedVideoIds } from "./rss";

/**
 * Daily search discovery: for each active query, run two passes (relevance + date)
 * with publishedAfter = last_run_at (or now - lookback_days on first run), collect
 * candidate video IDs, run them through the shared pipeline, then stamp last_run_at.
 */
export async function runSearchDiscovery(): Promise<{
  queriesRun: number;
  pipeline: PipelineSummary;
  perQueryErrors: string[];
}> {
  const config = await getConfig();
  const perQueryErrors: string[] = [];

  const { data: queries, error } = await supabase
    .from("search_queries")
    .select("*")
    .eq("active", true);
  if (error) throw new Error(`load queries: ${error.message}`);

  const now = new Date();
  const fallbackAfter = new Date(
    now.getTime() - config.lookback_days * 24 * 60 * 60 * 1000
  ).toISOString();

  const candidateIds = new Set<string>();

  for (const q of queries ?? []) {
    const publishedAfter = q.last_run_at ?? fallbackAfter;
    for (const order of ["relevance", "date"] as const) {
      try {
        const items = await searchVideos({
          query: q.query_text,
          order,
          publishedAfter,
        });
        for (const item of items) {
          if (item.id.videoId) candidateIds.add(item.id.videoId);
        }
      } catch (e) {
        perQueryErrors.push(
          `"${q.query_text}" (${order}): ${(e as Error).message}`
        );
      }
    }
  }

  const pipeline = await processVideoIds(Array.from(candidateIds), "search");

  // Stamp last_run_at for every active query we attempted.
  const ids = (queries ?? []).map((q) => q.id);
  if (ids.length > 0) {
    await supabase
      .from("search_queries")
      .update({ last_run_at: now.toISOString() })
      .in("id", ids);
  }

  return { queriesRun: queries?.length ?? 0, pipeline, perQueryErrors };
}

/**
 * Daily RSS poll of approved, monitored channels (no API quota for the feed;
 * video details still cost ~1 unit each via the pipeline).
 */
export async function runRssDiscovery(): Promise<{
  channelsPolled: number;
  pipeline: PipelineSummary;
  perChannelErrors: string[];
}> {
  const perChannelErrors: string[] = [];

  const { data: channels, error } = await supabase
    .from("channels")
    .select("id")
    .eq("status", "approved")
    .eq("rss_monitored", true);
  if (error) throw new Error(`load channels: ${error.message}`);

  const candidateIds = new Set<string>();
  for (const c of channels ?? []) {
    try {
      const ids = await fetchChannelFeedVideoIds(c.id);
      for (const id of ids) candidateIds.add(id);
    } catch (e) {
      perChannelErrors.push(`${c.id}: ${(e as Error).message}`);
    }
  }

  const pipeline = await processVideoIds(Array.from(candidateIds), "rss");
  return {
    channelsPolled: channels?.length ?? 0,
    pipeline,
    perChannelErrors,
  };
}
