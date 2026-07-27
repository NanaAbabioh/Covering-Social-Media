"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchQuery } from "@/lib/types";

export default function QueryManager({ queries }: { queries: SearchQuery[] }) {
  const router = useRouter();
  const [newQuery, setNewQuery] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const text = newQuery.trim();
    if (!text) return;
    setBusy(true);
    try {
      await fetch("/api/settings/queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query_text: text }),
      });
      setNewQuery("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(q: SearchQuery) {
    await fetch(`/api/settings/queries/${q.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !q.active }),
    });
    router.refresh();
  }

  async function remove(q: SearchQuery) {
    if (!confirm(`Delete query "${q.query_text}"?`)) return;
    await fetch(`/api/settings/queries/${q.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          value={newQuery}
          onChange={(e) => setNewQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a search query…"
          className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={add}
          disabled={busy || !newQuery.trim()}
          className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {queries.map((q) => (
          <li
            key={q.id}
            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span
              className={q.active ? "text-slate-800" : "text-slate-400 line-through"}
            >
              {q.query_text}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => toggle(q)}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                {q.active ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() => remove(q)}
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {queries.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-400">No queries yet.</li>
        )}
      </ul>
    </div>
  );
}
