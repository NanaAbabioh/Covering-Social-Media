"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reclassifyBacklogNow } from "../settings/actions";

/**
 * One-click backlog cleanup: runs the AI content-type classifier over every
 * video that hasn't been approved/rejected yet, then rebuilds the review queue
 * from the highest-scoring teaching/testimony videos.
 */
export default function ReclassifyButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await reclassifyBacklogNow();
      if (res.ok) {
        const r = res.result;
        setIsError(false);
        setMsg(
          `Classified ${r.classified} videos → ${r.kept} kept, ${r.skipped} skipped as wrong type, ${r.queued} now in the queue.` +
            (r.errors.length ? ` (${r.errors.length} classifier errors)` : "")
        );
        router.refresh();
      } else {
        setIsError(true);
        setMsg(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-50"
      >
        {pending ? "Reclassifying…" : "Reclassify backlog & rebuild queue"}
      </button>
      {msg && (
        <span className={`text-sm ${isError ? "text-red-600" : "text-emerald-700"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
