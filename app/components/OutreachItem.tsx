"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Outreach } from "@/lib/types";
import { formatDate } from "@/lib/format";

const RESPONSE_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  yes: "bg-emerald-100 text-emerald-700",
  no: "bg-red-100 text-red-700",
  revoked: "bg-orange-100 text-orange-700",
};

/**
 * A single outreach record with controls to record the response and the exact
 * permission wording (credit is not permission — a recorded "yes" is required
 * before anything can be posted).
 */
export default function OutreachItem({
  outreach,
  videoTitle,
}: {
  outreach: Outreach;
  videoTitle?: string | null;
}) {
  const router = useRouter();
  const [wording, setWording] = useState(outreach.permission_wording ?? "");
  const [busy, setBusy] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/outreach/${outreach.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            RESPONSE_STYLES[outreach.response] ?? RESPONSE_STYLES.pending
          }`}
        >
          {outreach.response.toUpperCase()}
        </span>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
          {outreach.ask_type === "standing" ? "Standing" : "One-time"}
        </span>
        <span className="text-slate-500">
          asked {formatDate(outreach.asked_at)}
          {outreach.response_at && ` · responded ${formatDate(outreach.response_at)}`}
        </span>
      </div>

      {outreach.video_id && (
        <p className="mt-1 text-xs text-slate-500">
          Clip: {videoTitle ?? outreach.video_id}
        </p>
      )}
      {outreach.notes && (
        <p className="mt-1 text-xs text-slate-500">Note: {outreach.notes}</p>
      )}

      {/* Response controls */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(["yes", "no", "revoked", "pending"] as const).map((r) => (
          <button
            key={r}
            onClick={() => patch({ response: r })}
            disabled={busy || outreach.response === r}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium capitalize text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Mark {r}
          </button>
        ))}
      </div>

      {/* Exact permission wording (required to substantiate a "yes") */}
      <div className="mt-2">
        <label className="text-xs font-medium text-slate-500">
          Exact permission wording (paste the creator&apos;s words)
        </label>
        <div className="mt-1 flex gap-2">
          <textarea
            value={wording}
            onChange={(e) => setWording(e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder='"Yes, you can use a clip from this video with credit."'
          />
          <button
            onClick={() => patch({ permission_wording: wording })}
            disabled={busy || wording === (outreach.permission_wording ?? "")}
            className="shrink-0 self-start rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
