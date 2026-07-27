import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record a published post. `outreach_id` is REQUIRED and the DB trigger rejects
 * any outreach whose response isn't "yes" — permission-first, enforced.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { video_id, outreach_id, platform, post_url, posted_at } = body as {
    video_id?: string;
    outreach_id?: string;
    platform?: string;
    post_url?: string;
    posted_at?: string;
  };

  if (!outreach_id) {
    return NextResponse.json(
      { error: "outreach_id is required — a post must link to a recorded permission." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("posts").insert({
    video_id: video_id || null,
    outreach_id,
    platform: platform || null,
    post_url: post_url || null,
    posted_at: posted_at || new Date().toISOString(),
  });

  if (error) {
    // The permission trigger surfaces here if the grant isn't "yes".
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
