import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Content-TYPE classifier. The keep/skip distinction in this niche is semantic,
 * not keyword-based: both a sermon about praying for your kids and a recited
 * "Powerful Family Prayer" share the same vocabulary. Keyword scoring can't tell
 * them apart, so we ask Claude to read each candidate's title + description and
 * label the format.
 *
 * KEEP  = a PERSON talking ABOUT praying for children — sermon/teaching,
 *         personal testimony/life experience, interview/podcast, practical how-to.
 * SKIP  = the video IS the prayer/worship content itself — a recited/spoken
 *         prayer, worship music, an AI "God says / God message" video, a
 *         scripture-only reading, or anything off-topic / not Christian.
 */

export type ContentType =
  | "teaching"
  | "testimony"
  | "interview"
  | "howto"
  | "spoken_prayer"
  | "worship_music"
  | "ai_god_message"
  | "scripture_reading"
  | "other";

export const KEEP_TYPES: ContentType[] = [
  "teaching",
  "testimony",
  "interview",
  "howto",
];

export type Classification = {
  keep: boolean;
  type: ContentType;
  reason: string;
};

export const DEFAULT_CLASSIFIER_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You classify YouTube videos for a very specific Christian content pipeline.

We are looking for ONE narrow thing: a sermon, preaching, or Bible teaching about the IMPORTANCE OF PRAYING FOR YOUR CHILDREN — a pastor/minister/believer teaching WHY and how parents should intercede for their kids (covering them in prayer, praying for their protection, salvation, faith, and future). Established ministers preaching this message are the ideal.

KEEP (keep = true) — ONLY if the video's central subject is a parent/believer PRAYING FOR their children, delivered as teaching/testimony:
- "teaching": a sermon, message, or Bible teaching on the importance of praying for / interceding for / covering your children in prayer.
- "testimony": someone recounting how praying for their children mattered — a real story, taught reflectively.
- "interview": an interview or podcast whose focus is praying for one's children.

SKIP (keep = false) — EVERYTHING ELSE, including things that look related. Be strict:
- "other": general Christian parenting or raising godly kids; discipline/behavior advice; bedtime or prayer ROUTINES; motherhood/fatherhood reflections; family devotionals; teaching CHILDREN how to pray (kids praying) or praying WITH kids as an activity; marriage/family content; anything not squarely about a parent interceding in prayer FOR their children; anything not Christian or off-topic.
- "spoken_prayer": the video IS a recited/spoken prayer (e.g. "A Powerful Prayer For My Children", "Prayer for a Strong Relationship Between Parents and Children"). The creator is praying, not teaching about it.
- "worship_music": worship/music, sung or instrumental, including prayer set to music.
- "ai_god_message": AI-generated "God says / God message / My child, your prayer is answered" videos.
- "scripture_reading": plain scripture/verse reading with no teaching.

Decision rules:
- Judge by INTENT and SUBJECT, not keywords — "prayer" and "children" appear in both kept and skipped videos.
- The subject must be the ACT of praying for one's children. "How to raise godly kids", "bedtime routine", "teaching my toddler to pray", "Christian motherhood", "family devotional" are all SKIP even though they're Christian and about kids.
- If the title reads like the video itself is a prayer addressed to God ("Lord, protect my children"), it is spoken_prayer.
- When genuinely unsure, SKIP. Precision matters far more than recall — a wrongly-kept video wastes review time.

Return ONLY a JSON object, no prose and no markdown code fences, of the exact shape:
{"results":[{"id":"<video id>","keep":true|false,"type":"<one of the types above>","reason":"<short reason>"}]}
Include exactly one result object per input video, preserving the given id.`;

export type ClassifyInput = { id: string; title: string; description: string };

const BATCH_SIZE = 20;
const CONCURRENCY = 4;

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var");
  return new Anthropic({ apiKey });
}

/** Parse a JSON object from model output, tolerating stray prose or ```json fences. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("could not parse classifier JSON");
  }
}

async function classifyBatch(
  anthropic: Anthropic,
  model: string,
  batch: ClassifyInput[]
): Promise<Map<string, Classification>> {
  const userText = batch
    .map(
      (v, i) =>
        `${i + 1}. id=${v.id}\nTitle: ${v.title}\nDescription: ${(
          v.description ?? ""
        )
          .slice(0, 400)
          .replace(/\s+/g, " ")}`
    )
    .join("\n\n");

  const res = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Classify these ${batch.length} videos:\n\n${userText}`,
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const parsed = extractJson(raw) as {
    results?: { id: string; keep: boolean; type: ContentType; reason?: string }[];
  };

  const out = new Map<string, Classification>();
  for (const r of parsed.results ?? []) {
    out.set(r.id, {
      keep: r.keep,
      type: r.type,
      reason: r.reason ?? "",
    });
  }
  return out;
}

async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    await next();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next())
  );
  return results;
}

/**
 * Classify a set of videos. Returns a map keyed by video id. Any video missing
 * from a batch's response (or in a batch that errors) defaults to keep=true,
 * type "teaching" so a classifier hiccup fails open rather than silently
 * dropping legitimate content — the human review is the final gate.
 */
export async function classifyVideos(
  videos: ClassifyInput[],
  model: string = DEFAULT_CLASSIFIER_MODEL
): Promise<{ map: Map<string, Classification>; errors: string[] }> {
  const errors: string[] = [];
  const map = new Map<string, Classification>();
  if (videos.length === 0) return { map, errors };

  const anthropic = client();
  const batches: ClassifyInput[][] = [];
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    batches.push(videos.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await runPool(batches, CONCURRENCY, async (batch) => {
    try {
      return await classifyBatch(anthropic, model, batch);
    } catch (e) {
      errors.push((e as Error).message);
      // Fail open for this batch.
      const fallback = new Map<string, Classification>();
      for (const v of batch) {
        fallback.set(v.id, {
          keep: true,
          type: "teaching",
          reason: "classifier error — kept for manual review",
        });
      }
      return fallback;
    }
  });

  for (const b of batchResults) {
    for (const [id, c] of b) map.set(id, c);
  }

  // Any video with no verdict at all (dropped from a successful response) fails open.
  for (const v of videos) {
    if (!map.has(v.id)) {
      map.set(v.id, {
        keep: true,
        type: "teaching",
        reason: "no classifier verdict — kept for manual review",
      });
    }
  }

  return { map, errors };
}
