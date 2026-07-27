"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClipOption = { id: string; title: string | null };

/**
 * Log a new permission ask for a channel. A video may be attached (one-time clip
 * ask) or left blank (standing arrangement).
 */
export default function NewOutreach({
  channelId,
  clips,
}: {
  channelId: string;
  clips: ClipOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [videoId, setVideoId] = useState<string>(clips[0]?.id ?? "");
  const [askType, setAskType] = useState<"one_time" | "standing">("one_time");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel_id: channelId,
          video_id: askType === "standing" ? null : videoId || null,
          ask_type: askType,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setOpen(false);
      setNotes("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5"
      >
        + Log a permission ask
      </button>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col text-sm">
          <span className="text-xs text-slate-500">Ask type</span>
          <select
            value={askType}
            onChange={(e) => setAskType(e.target.value as "one_time" | "standing")}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="one_time">One-time (this clip)</option>
            <option value="standing">Standing (ongoing excerpts)</option>
          </select>
        </label>
        {askType === "one_time" && (
          <label className="flex flex-col text-sm">
            <span className="text-xs text-slate-500">Clip / video</span>
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="max-w-xs rounded border border-slate-300 px-2 py-1"
            >
              <option value="">— none —</option>
              {clips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title?.slice(0, 50) ?? c.id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="mt-2 flex flex-col text-sm">
        <span className="text-xs text-slate-500">Notes (how/when you reached out)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Emailed via contact form on 2026-07-26"
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save ask"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
