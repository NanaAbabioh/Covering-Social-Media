import "server-only";

/**
 * Thin wrapper around the YouTube Data API v3 endpoints we need.
 * Quota notes: search.list = 100 units/call; videos.list & channels.list = ~1 unit/call.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("Missing YOUTUBE_API_KEY env var");
  return key;
}

async function ytGet<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube ${endpoint} ${res.status}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export type YtSearchItem = {
  id: { videoId?: string };
  snippet: {
    channelId: string;
    title: string;
    description: string;
    publishedAt: string;
  };
};

/**
 * One search.list call. `order` is 'relevance' or 'date'. `publishedAfter` is an
 * RFC 3339 timestamp. Returns raw items (we only keep videoIds downstream).
 */
export async function searchVideos(opts: {
  query: string;
  order: "relevance" | "date";
  publishedAfter: string;
  maxResults?: number;
}): Promise<YtSearchItem[]> {
  const data = await ytGet<{ items: YtSearchItem[] }>("search", {
    part: "snippet",
    q: opts.query,
    type: "video",
    order: opts.order,
    publishedAfter: opts.publishedAfter,
    maxResults: String(opts.maxResults ?? 50),
    relevanceLanguage: "en",
    safeSearch: "moderate",
  });
  return data.items ?? [];
}

export type YtVideo = {
  id: string;
  snippet: {
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnails?: Record<string, { url: string }>;
  };
  statistics: {
    viewCount?: string;
    commentCount?: string; // absent when comments are disabled
    likeCount?: string;
  };
  contentDetails: { duration: string };
};

/** videos.list for up to 50 IDs per call; batches internally. */
export async function getVideos(ids: string[]): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    if (batch.length === 0) continue;
    const data = await ytGet<{ items: YtVideo[] }>("videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    });
    out.push(...(data.items ?? []));
  }
  return out;
}

export type YtChannel = {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    customUrl?: string;
  };
  statistics: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
  };
};

/** channels.list for up to 50 IDs per call; batches internally. */
export async function getChannels(ids: string[]): Promise<YtChannel[]> {
  const unique = Array.from(new Set(ids));
  const out: YtChannel[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    if (batch.length === 0) continue;
    const data = await ytGet<{ items: YtChannel[] }>("channels", {
      part: "snippet,statistics",
      id: batch.join(","),
    });
    out.push(...(data.items ?? []));
  }
  return out;
}

export function videoUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function channelUrl(id: string): string {
  return `https://www.youtube.com/channel/${id}`;
}
