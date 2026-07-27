import "server-only";
import { XMLParser } from "fast-xml-parser";

/**
 * Parse a YouTube channel's public Atom feed (no API quota cost):
 *   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 * Returns the recent video IDs. YouTube caps the feed at ~15 latest uploads.
 */

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export async function fetchChannelFeedVideoIds(channelId: string): Promise<string[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
    channelId
  )}`;
  const res = await fetch(url, {
    headers: { "user-agent": "TheCovering-ContentPipeline/1.0" },
  });
  if (!res.ok) {
    throw new Error(`RSS ${channelId} ${res.status}`);
  }
  const xml = await res.text();
  const doc = parser.parse(xml);

  const entries = doc?.feed?.entry;
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];

  const ids: string[] = [];
  for (const entry of list) {
    // <yt:videoId>...</yt:videoId>  (parser strips the yt: prefix to "videoId")
    const vid = entry?.["yt:videoId"] ?? entry?.videoId;
    if (typeof vid === "string" && vid.length > 0) ids.push(vid);
  }
  return ids;
}
