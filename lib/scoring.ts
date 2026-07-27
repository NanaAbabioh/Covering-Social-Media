import type { AppConfig } from "./settings";
import type { YtVideo, YtChannel } from "./youtube";

/**
 * Quality-over-quantity scoring. Each signal produces a 0..1 strength, multiplied
 * by its configured weight. The breakdown (with human-readable notes) is stored on
 * the video so the review UI can explain WHY something scored the way it did.
 */

export type SignalBreakdown = {
  key: string;
  label: string;
  points: number; // weighted points earned
  max: number; // weight (max possible)
  strength: number; // 0..1 raw signal
  note: string;
};

export type ScoreSignals = {
  total: number;
  breakdown: SignalBreakdown[];
  red_flags: string[];
  // Added by the pipeline after AI content-type classification:
  content_type?: string;
  classifier_reason?: string;
  keep?: boolean;
};

export type ScoreResult = {
  score: number;
  signals: ScoreSignals;
  redFlags: string[];
  // Derived channel fields the discovery route persists onto the channel row:
  uploadsPerWeek: number | null;
  channelAgeDays: number | null;
  website: string | null;
};

// Niche relevance vocabulary (Christian parenting + prayer).
const NICHE_KEYWORDS = [
  "pray",
  "prayer",
  "praying",
  "child",
  "children",
  "kid",
  "kids",
  "parent",
  "parenting",
  "godly",
  "devotion",
  "devotional",
  "scripture",
  "faith",
  "christian",
  "jesus",
  "god",
  "bible",
  "mother",
  "father",
  "mom",
  "dad",
  "family",
];

// Hosts that don't count as a "real ministry/personal website".
const SOCIAL_HOSTS = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.com",
  "twitter.com",
  "x.com",
  "linktr.ee",
  "beacons.ai",
  "linktree",
  "patreon.com",
  "amazon.com",
  "amzn.to",
  "paypal.com",
  "venmo.com",
  "cash.app",
  "bit.ly",
];

const URL_RE = /https?:\/\/[^\s)\]}"'<>]+/gi;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/** Find the first non-social URL in the given text blocks; returns its origin. */
function extractRealWebsite(...texts: (string | undefined | null)[]): string | null {
  for (const text of texts) {
    if (!text) continue;
    const matches = text.match(URL_RE);
    if (!matches) continue;
    for (const raw of matches) {
      let host: string;
      try {
        host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
      } catch {
        continue;
      }
      if (SOCIAL_HOSTS.some((s) => host.includes(s))) continue;
      try {
        return new URL(raw).origin;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function countNicheKeywords(text: string): number {
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const kw of NICHE_KEYWORDS) {
    if (lower.includes(kw)) hits.add(kw);
  }
  return hits.size;
}

export function scoreVideo(input: {
  video: YtVideo;
  channel: YtChannel | undefined;
  config: AppConfig;
  now?: Date;
}): ScoreResult {
  const { video, channel, config } = input;
  const now = input.now ?? new Date();
  const w = config.weights;
  const t = config.thresholds;

  const breakdown: SignalBreakdown[] = [];
  const redFlags: string[] = [];

  const views = Number(video.statistics.viewCount ?? 0);
  const commentsRaw = video.statistics.commentCount;
  const commentsDisabled = commentsRaw === undefined;
  const comments = Number(commentsRaw ?? 0);

  const videoCount = channel ? Number(channel.statistics.videoCount ?? 0) : 0;
  const channelPublishedAt = channel
    ? new Date(channel.snippet.publishedAt)
    : null;
  const channelAgeDays = channelPublishedAt
    ? daysBetween(now, channelPublishedAt)
    : null;

  // --- 1. Upload cadence -----------------------------------------------------
  let uploadsPerWeek: number | null = null;
  {
    let strength = 0.5;
    let note = "Unknown channel cadence.";
    if (channelAgeDays && channelAgeDays > 7 && videoCount > 0) {
      uploadsPerWeek = videoCount / (channelAgeDays / 7);
      const upw = uploadsPerWeek;
      const good = t.good_uploads_per_week;
      if (upw >= t.farm_uploads_per_week) {
        strength = 0;
        note = `~${upw.toFixed(1)} uploads/week — very high; likely a content farm.`;
        redFlags.push(`High upload frequency (~${upw.toFixed(1)}/wk)`);
      } else {
        const ratio = upw / good;
        if (ratio >= 0.5 && ratio <= 2) {
          strength = 1;
          note = `~${upw.toFixed(1)} uploads/week — healthy, sustainable cadence.`;
        } else if (ratio < 0.5) {
          strength = 0.7;
          note = `~${upw.toFixed(2)} uploads/week — low/occasional cadence.`;
        } else {
          // between 2x good and the farm threshold: taper down
          const span = t.farm_uploads_per_week - good * 2;
          strength = span > 0 ? clamp01(1 - (upw - good * 2) / span) * 0.7 + 0.3 : 0.4;
          note = `~${upw.toFixed(1)} uploads/week — fairly frequent.`;
        }
      }
    }
    breakdown.push({
      key: "cadence",
      label: "Upload cadence",
      strength,
      max: w.cadence,
      points: strength * w.cadence,
      note,
    });
  }

  // --- 2. Channel longevity --------------------------------------------------
  {
    let strength = 0.5;
    let note = "Unknown channel age.";
    if (channelAgeDays !== null) {
      const minAge = t.min_channel_age_days;
      strength = clamp01(channelAgeDays / (minAge * 3));
      const years = (channelAgeDays / 365).toFixed(1);
      note = `Channel is ~${years} yr old.`;
      if (channelAgeDays < minAge) {
        note = `Channel is new (~${Math.round(channelAgeDays)} days).`;
        redFlags.push("New channel");
      }
    }
    breakdown.push({
      key: "longevity",
      label: "Channel longevity",
      strength,
      max: w.longevity,
      points: strength * w.longevity,
      note,
    });
  }

  // --- 3. Engagement (comments-to-views) ------------------------------------
  {
    let strength = 0;
    let note = "";
    if (commentsDisabled) {
      strength = 0;
      note = "Comments are disabled.";
      redFlags.push("Comments disabled");
    } else if (views > 0) {
      const ratio = comments / views;
      strength = clamp01(ratio / 0.005);
      note = `${comments.toLocaleString()} comments on ${views.toLocaleString()} views (${(
        ratio * 100
      ).toFixed(2)}%).`;
    } else {
      strength = 0.3;
      note = "Very few views so far.";
    }
    breakdown.push({
      key: "engagement",
      label: "Engagement",
      strength,
      max: w.engagement,
      points: strength * w.engagement,
      note,
    });
  }

  // --- 4. Real website -------------------------------------------------------
  const website = extractRealWebsite(
    channel?.snippet.description,
    video.snippet.description
  );
  {
    const strength = website ? 1 : 0;
    const note = website
      ? `Links a real site: ${website}`
      : "No ministry/personal website linked.";
    breakdown.push({
      key: "website",
      label: "Real website",
      strength,
      max: w.website,
      points: strength * w.website,
      note,
    });
  }

  // --- 5. Description depth --------------------------------------------------
  {
    const desc = video.snippet.description ?? "";
    const len = desc.trim().length;
    let strength: number;
    if (len > 600) strength = 1;
    else if (len > 300) strength = 0.7;
    else if (len > 100) strength = 0.4;
    else strength = 0.1;
    const note = `Description ~${len} chars.`;
    breakdown.push({
      key: "description",
      label: "Description depth",
      strength,
      max: w.description,
      points: strength * w.description,
      note,
    });
  }

  // --- 6. Keyword relevance --------------------------------------------------
  {
    const hits = countNicheKeywords(
      `${video.snippet.title} ${video.snippet.description}`
    );
    const strength = clamp01(hits / 5);
    breakdown.push({
      key: "relevance",
      label: "Keyword relevance",
      strength,
      max: w.relevance,
      points: strength * w.relevance,
      note: `${hits} distinct niche keyword${hits === 1 ? "" : "s"} in title/description.`,
    });
  }

  const total = breakdown.reduce((sum, b) => sum + b.points, 0);
  const rounded = Math.round(total * 10) / 10;

  return {
    score: rounded,
    signals: { total: rounded, breakdown, red_flags: redFlags },
    redFlags,
    uploadsPerWeek,
    channelAgeDays,
    website,
  };
}
