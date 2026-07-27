"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CourtesyToggle({
  postId,
  initial,
}: {
  postId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !checked;
    setChecked(next);
    setBusy(true);
    try {
      await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courtesy_notified: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={busy}
        className="h-3.5 w-3.5 rounded border-slate-300"
      />
      Courtesy-notified
    </label>
  );
}
