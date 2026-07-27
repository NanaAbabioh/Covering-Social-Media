import type { ScoreSignals } from "@/lib/scoring";

/**
 * Renders the "why" behind a score: each weighted signal as a labeled bar plus
 * its note, and any red flags as warning badges.
 */
export default function ScoreSignalsView({
  signals,
}: {
  signals: ScoreSignals | null | undefined;
}) {
  if (!signals || !signals.breakdown) {
    return <p className="text-sm text-slate-400">No score breakdown.</p>;
  }

  return (
    <div className="space-y-2">
      {signals.red_flags && signals.red_flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {signals.red_flags.map((flag) => (
            <span
              key={flag}
              className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
            >
              ⚠ {flag}
            </span>
          ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {signals.breakdown.map((b) => {
          const pct = b.max > 0 ? Math.round((b.points / b.max) * 100) : 0;
          return (
            <li key={b.key} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{b.label}</span>
                <span className="tabular-nums text-slate-500">
                  {b.points.toFixed(1)}/{b.max}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-0.5 text-slate-500">{b.note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
