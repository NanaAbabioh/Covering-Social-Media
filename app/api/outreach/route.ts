import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Log a new outreach ask (permission request). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { channel_id, video_id, ask_type, notes, asked_at } = body as {
    channel_id?: string;
    video_id?: string | null;
    ask_type?: string;
    notes?: string;
    asked_at?: string;
  };

  if (!channel_id) {
    return NextResponse.json({ error: "channel_id required" }, { status: 400 });
  }
  if (ask_type && !["one_time", "standing"].includes(ask_type)) {
    return NextResponse.json({ error: "invalid ask_type" }, { status: 400 });
  }

  const { error } = await supabase.from("outreach").insert({
    channel_id,
    video_id: video_id || null,
    ask_type: ask_type ?? "one_time",
    notes: notes ?? null,
    asked_at: asked_at ?? new Date().toISOString(),
    response: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
