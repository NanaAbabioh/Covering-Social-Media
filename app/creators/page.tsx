import { supabase } from "@/lib/supabase";
import type { Channel, Outreach, Video } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import ContactEditor from "../components/ContactEditor";
import NewOutreach from "../components/NewOutreach";
import OutreachItem from "../components/OutreachItem";

export const dynamic = "force-dynamic";

type ChannelWithRels = Channel & {
  outreach: Outreach[];
  videos: Pick<Video, "id" | "title" | "status" | "clip_timestamp" | "clip_note">[];
};

export default async function CreatorsPage() {
  const { data, error } = await supabase
    .from("channels")
    .select(
      "*, outreach(*), videos(id,title,status,clip_timestamp,clip_note)"
    )
    .eq("status", "approved")
    .order("name");

  const channels = (data ?? []) as unknown as ChannelWithRels[];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Creators / CRM</h1>
        <p className="text-sm text-slate-500">
          Approved channels, permission asks, and recorded grants. A post can only
          be published once an ask here is marked <strong>yes</strong>.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load creators: {error.message}
        </div>
      )}

      {!error && channels.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No approved creators yet. Approve a video in the{" "}
          <a href="/" className="text-brand hover:underline">
            Review Queue
          </a>{" "}
          to promote its channel here.
        </div>
      )}

      <div className="space-y-5">
        {channels.map((ch) => {
          const approvedClips = ch.videos.filter((v) => v.status === "approved");
          const videoTitle = new Map(ch.videos.map((v) => [v.id, v.title]));
          const outreach = [...ch.outreach].sort(
            (a, b) =>
              new Date(b.asked_at ?? b.created_at).getTime() -
              new Date(a.asked_at ?? a.created_at).getTime()
          );
          const hasYes = outreach.some((o) => o.response === "yes");

          return (
            <section
              key={ch.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <a
                    href={ch.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg font-semibold text-slate-900 hover:text-brand"
                  >
                    {ch.name ?? ch.id}
                  </a>
                  <p className="text-sm text-slate-500">
                    {formatNumber(ch.subscriber_count)} subscribers ·{" "}
                    {formatNumber(ch.video_count)} videos
                    {ch.upload_frequency !== null &&
                      ` · ~${ch.upload_frequency.toFixed(1)}/wk`}
                  </p>
                </div>
                {hasYes && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    ✓ Permission on file
                  </span>
                )}
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <ContactEditor
                  channelId={ch.id}
                  email={ch.contact_email}
                  website={ch.website}
                />
              </div>

              {approvedClips.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Approved clips
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {approvedClips.map((v) => (
                      <li key={v.id} className="text-slate-600">
                        <a
                          href={`https://www.youtube.com/watch?v=${v.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-700 hover:text-brand"
                        >
                          {v.title}
                        </a>
                        {v.clip_timestamp && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            {v.clip_timestamp}
                          </span>
                        )}
                        {v.clip_note && (
                          <span className="ml-2 text-xs italic text-slate-500">
                            “{v.clip_note}”
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Outreach log
                  </h3>
                  <NewOutreach
                    channelId={ch.id}
                    clips={approvedClips.map((v) => ({ id: v.id, title: v.title }))}
                  />
                </div>
                {outreach.length === 0 ? (
                  <p className="text-sm text-slate-400">No asks logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {outreach.map((o) => (
                      <OutreachItem
                        key={o.id}
                        outreach={o}
                        videoTitle={o.video_id ? videoTitle.get(o.video_id) : null}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
