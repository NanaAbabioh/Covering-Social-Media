import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

type SearchQueryUpdate = Database["public"]["Tables"]["search_queries"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit a query's text or active flag. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.query_text === "string") update.query_text = body.query_text.trim();
  if (typeof body.active === "boolean") update.active = body.active;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }
  const { error } = await supabase
    .from("search_queries")
    .update(update as SearchQueryUpdate)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** Delete a query. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await supabase
    .from("search_queries")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
