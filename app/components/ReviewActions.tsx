"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Approve / Maybe / Reject buttons for a queued video. Approve opens a small
 * modal to capture the clip timestamp + why it's powerful (feeds outreach later).
 */
export default function ReviewActions({
  videoId,
  onResolved,
}: {
  videoId: string;
  onResolved?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [clipTs, setClipTs] = useState("");
  const [clipNote, setClipNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function setStatus(
    status: string,
    extra?: { clip_timestamp?: string; clip_note?: string }
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      setShowApprove(false);
      // Optimistically remove this card from the queue immediately, then
      // reconcile with the server (which may have backfilled a new candidate).
      onResolved?.();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowApprove(true)}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => setStatus("maybe")}
          disabled={busy}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          ? Maybe
        </button>
        <button
          onClick={() => setStatus("rejected")}
          disabled={busy}
          className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50"
        >
          ✕ Reject
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {showApprove && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 text-sm font-medium text-emerald-800">
            Approve — capture the clip moment
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Clip timestamp (e.g. 3:45 or 3:45–4:10)
          </label>
          <input
            value={clipTs}
            onChange={(e) => setClipTs(e.target.value)}
            placeholder="3:45–4:10"
            className="mb-2 mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <label className="block text-xs font-medium text-slate-600">
            Why it&apos;s powerful (one line — feeds the outreach email)
          </label>
          <textarea
            value={clipNote}
            onChange={(e) => setClipNote(e.target.value)}
            rows={2}
            placeholder="A raw, honest moment about praying through fear for a sick child."
            className="mb-2 mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() =>
                setStatus("approved", {
                  clip_timestamp: clipTs,
                  clip_note: clipNote,
                })
              }
              disabled={busy}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Confirm approve"}
            </button>
            <button
              onClick={() => setShowApprove(false)}
              disabled={busy}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
