import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types";

type OutreachUpdate = Database["public"]["Tables"]["outreach"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Record/update a response to an outreach ask (yes/no/revoked + exact wording). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const { response, permission_wording, notes, ask_type } = body as {
    response?: string;
    permission_wording?: string;
    notes?: string;
    ask_type?: string;
  };

  const update: Record<string, unknown> = {};
  if (response !== undefined) {
    if (!["pending", "yes", "no", "revoked"].includes(response)) {
      return NextResponse.json({ error: "invalid response" }, { status: 400 });
    }
    update.response = response;
    update.response_at =
      response === "pending" ? null : new Date().toISOString();
  }
  if (permission_wording !== undefined) update.permission_wording = permission_wording;
  if (notes !== undefined) update.notes = notes;
  if (ask_type !== undefined) update.ask_type = ask_type;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("outreach")
    .update(update as OutreachUpdate)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
