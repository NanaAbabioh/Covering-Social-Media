import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

type VideoUpdate = Database["public"]["Tables"]["videos"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS = ["queued", "approved", "rejected", "maybe", "suppressed"];

/**
 * Update a video's review status (and, on approve, clip details). Approving a
 * video promotes its channel to `approved` and enables RSS monitoring so future
 * uploads arrive quota-free.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const { status, clip_timestamp, clip_note } = body as {
    status?: string;
    clip_timestamp?: string;
    clip_note?: string;
  };

  if (!status || !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (clip_timestamp !== undefined) update.clip_timestamp = clip_timestamp;
  if (clip_note !== undefined) update.clip_note = clip_note;

  const { data: video, error } = await supabase
    .from("videos")
    .update(update as VideoUpdate)
    .eq("id", params.id)
    .select("id, channel_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Promote the channel on approval.
  if (status === "approved" && video?.channel_id) {
    const { error: chErr } = await supabase
      .from("channels")
      .update({ status: "approved", rss_monitored: true })
      .eq("id", video.channel_id);
    if (chErr) {
      return NextResponse.json(
        { ok: true, warning: `video updated but channel promote failed: ${chErr.message}` },
        { status: 200 }
      );
    }
  }

  // A reviewed video simply leaves the queue — the queue drains as you work
  // through it and is refilled only by discovery runs (daily cron / "Run
  // discovery now") or the "Reclassify backlog & rebuild queue" button.
  return NextResponse.json({ ok: true });
}
