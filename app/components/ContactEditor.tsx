"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ContactEditor({
  channelId,
  email,
  website,
}: {
  channelId: string;
  email: string | null;
  website: string | null;
}) {
  const router = useRouter();
  const [e, setE] = useState(email ?? "");
  const [w, setW] = useState(website ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = e !== (email ?? "") || w !== (website ?? "");

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact_email: e || null, website: w || null }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">Contact email</span>
        <input
          value={e}
          onChange={(ev) => setE(ev.target.value)}
          placeholder="creator@example.com"
          className="w-56 rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">Website</span>
        <input
          value={w}
          onChange={(ev) => setW(ev.target.value)}
          placeholder="https://…"
          className="w-56 rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {saved && !dirty && <span className="text-xs text-emerald-600">Saved ✓</span>}
    </div>
  );
}
