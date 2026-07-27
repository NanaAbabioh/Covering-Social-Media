import type { Channel, Video } from "@/lib/types";
import type { ScoreSignals } from "@/lib/scoring";
import { formatDuration, formatNumber, timeAgo } from "@/lib/format";
import ScoreSignalsView from "./ScoreSignals";
import ReviewActions from "./ReviewActions";

export type VideoWithChannel = Video & { channels: Channel | null };

export default function VideoCard({ video }: { video: VideoWithChannel }) {
  const channel = video.channels;
  const signals = video.score_signals as unknown as ScoreSignals | null;

  return (
    <article className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,340px)_1fr]">
      {/* Left: player + core stats */}
      <div>
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${video.id}`}
            title={video.title ?? video.id}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{formatDuration(video.duration)}</span>
          <span>{formatNumber(video.view_count)} views</span>
          <span>
            {video.comment_count === null
              ? "comments off"
              : `${formatNumber(video.comment_count)} comments`}
          </span>
          <span>{timeAgo(video.published_at)}</span>
        </div>
      </div>

      {/* Right: title, channel, score, actions */}
      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold leading-snug text-slate-900">
            {video.title}
          </h2>
          <div className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-center">
            <div className="text-lg font-bold leading-none text-brand">
              {video.score?.toFixed(0) ?? "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-brand/70">
              score
            </div>
          </div>
        </div>

        {channel && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
            <a
              href={channel.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-700 hover:text-brand hover:underline"
            >
              {channel.name}
            </a>
            <span className="text-slate-300">•</span>
            <span>{formatNumber(channel.subscriber_count)} subs</span>
            <span className="text-slate-300">•</span>
            <span>{formatNumber(channel.video_count)} videos</span>
            {channel.upload_frequency !== null && (
              <>
                <span className="text-slate-300">•</span>
                <span>~{channel.upload_frequency.toFixed(1)}/wk</span>
              </>
            )}
            {channel.website && (
              <>
                <span className="text-slate-300">•</span>
                <a
                  href={channel.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 hover:underline"
                >
                  website ↗
                </a>
              </>
            )}
          </div>
        )}

        <div className="mt-3">
          <ScoreSignalsView signals={signals} />
        </div>

        <div className="mt-auto pt-4">
          <ReviewActions videoId={video.id} />
        </div>
      </div>
    </article>
  );
}
