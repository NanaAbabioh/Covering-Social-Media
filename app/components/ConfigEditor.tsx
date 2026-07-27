"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/lib/settings";

const WEIGHT_LABELS: Record<keyof AppConfig["weights"], string> = {
  authority: "Ministry reach (subs)",
  cadence: "Upload cadence",
  longevity: "Channel longevity",
  engagement: "Engagement",
  website: "Real website",
  description: "Description depth",
  relevance: "Keyword relevance",
};

export default function ConfigEditor({ config }: { config: AppConfig }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<AppConfig>(config);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalWeight = Object.values(cfg.weights).reduce((a, b) => a + b, 0);

  function num(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
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
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col text-sm">
          <span className="text-xs text-slate-500">Queue cap (max in review queue)</span>
          <input
            type="number"
            value={cfg.queue_cap}
            onChange={(e) => setCfg({ ...cfg, queue_cap: num(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-xs text-slate-500">First-run lookback (days)</span>
          <input
            type="number"
            value={cfg.lookback_days}
            onChange={(e) => setCfg({ ...cfg, lookback_days: num(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="text-xs text-slate-500">
            AI classifier model (teaching/testimony vs. spoken-prayer/worship)
          </span>
          <select
            value={cfg.classifier_model}
            onChange={(e) => setCfg({ ...cfg, classifier_model: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="claude-haiku-4-5">
              Claude Haiku 4.5 — fast &amp; cheap (default)
            </option>
            <option value="claude-sonnet-5">
              Claude Sonnet 5 — more accurate, higher cost
            </option>
            <option value="claude-opus-5">
              Claude Opus 5 — most accurate, highest cost
            </option>
          </select>
        </label>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Scoring weights{" "}
          <span className="font-normal normal-case text-slate-400">
            (total {totalWeight} = max score)
          </span>
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(cfg.weights) as (keyof AppConfig["weights"])[]).map((k) => (
            <label key={k} className="flex flex-col text-sm">
              <span className="text-xs text-slate-500">{WEIGHT_LABELS[k]}</span>
              <input
                type="number"
                value={cfg.weights[k]}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    weights: { ...cfg.weights, [k]: num(e.target.value) },
                  })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Thresholds
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col text-sm">
            <span className="text-xs text-slate-500">Farm uploads/week (penalize ≥)</span>
            <input
              type="number"
              step="0.5"
              value={cfg.thresholds.farm_uploads_per_week}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  thresholds: {
                    ...cfg.thresholds,
                    farm_uploads_per_week: num(e.target.value),
                  },
                })
              }
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-xs text-slate-500">Ideal uploads/week</span>
            <input
              type="number"
              step="0.5"
              value={cfg.thresholds.good_uploads_per_week}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  thresholds: {
                    ...cfg.thresholds,
                    good_uploads_per_week: num(e.target.value),
                  },
                })
              }
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-xs text-slate-500">Min channel age (days)</span>
            <input
              type="number"
              value={cfg.thresholds.min_channel_age_days}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  thresholds: {
                    ...cfg.thresholds,
                    min_channel_age_days: num(e.target.value),
                  },
                })
              }
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
      </div>
    </div>
  );
}
