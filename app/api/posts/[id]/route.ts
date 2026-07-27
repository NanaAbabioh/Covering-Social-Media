import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update a post (e.g. toggle courtesy_notified for standing-permission posts). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const allowed = ["courtesy_notified", "platform", "post_url", "posted_at"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) update[key] = body[key];

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("posts")
    .update(update as PostUpdate)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
