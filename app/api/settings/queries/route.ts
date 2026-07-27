import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add a new search query. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const query_text = (body.query_text ?? "").toString().trim();
  if (!query_text) {
    return NextResponse.json({ error: "query_text required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("search_queries")
    .insert({ query_text, active: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
