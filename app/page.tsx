import { supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/settings";
import VideoCard, { type VideoWithChannel } from "./components/VideoCard";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const config = await getConfig();

  const { data, error } = await supabase
    .from("videos")
    .select("*, channels(*)")
    .eq("status", "queued")
    .order("score", { ascending: false });

  const videos = (data ?? []) as unknown as VideoWithChannel[];

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-500">
            Top-scored candidates awaiting your call. Cap: {config.queue_cap}.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          {videos.length} in queue
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load queue: {error.message}
        </div>
      )}

      {!error && videos.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">The review queue is empty.</p>
          <p className="mt-1 text-sm text-slate-400">
            Run discovery from{" "}
            <a href="/settings" className="text-brand hover:underline">
              Settings
            </a>{" "}
            to pull in fresh candidates.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </div>
  );
}
