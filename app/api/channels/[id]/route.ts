import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

type ChannelUpdate = Database["public"]["Tables"]["channels"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update a channel's contact info or status (used from the CRM). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const allowed = ["contact_email", "website", "status", "rss_monitored", "name"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("channels")
    .update(update as ChannelUpdate)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
