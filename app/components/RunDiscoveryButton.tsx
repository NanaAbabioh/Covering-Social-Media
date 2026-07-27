"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runDiscoveryNow } from "../settings/actions";

export default function RunDiscoveryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await runDiscoveryNow();
      if (res.ok) {
        const p = res.result.pipeline;
        setIsError(false);
        setMsg(
          `Ran ${res.result.queriesRun} queries → ${p.newIds} new, ${p.queued} queued, ${p.skippedByType} skipped as wrong type, ${p.suppressed} suppressed.` +
            (res.result.perQueryErrors.length
              ? ` (${res.result.perQueryErrors.length} query errors)`
              : "")
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
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Running discovery…" : "Run discovery now"}
      </button>
      {msg && (
        <span className={`text-sm ${isError ? "text-red-600" : "text-emerald-700"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
