"use client";

import { useState } from "react";
import VideoCard, { type VideoWithChannel } from "./VideoCard";

/**
 * Client wrapper around the review queue. Holds the list in state so a card can
 * be removed the instant its Approve/Reject/Maybe action succeeds (optimistic),
 * rather than waiting for the server refetch. router.refresh() (fired inside
 * ReviewActions) then reconciles — pulling in any backfilled candidate.
 */
export default function QueueList({ videos }: { videos: VideoWithChannel[] }) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const visible = videos.filter((v) => !resolved.has(v.id));

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-600">The review queue is clear.</p>
        <p className="mt-1 text-sm text-slate-400">
          New candidates will appear here after the next discovery run.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((v) => (
        <VideoCard
          key={v.id}
          video={v}
          onResolved={() =>
            setResolved((prev) => {
              const next = new Set(prev);
              next.add(v.id);
              return next;
            })
          }
        />
      ))}
    </div>
  );
}
