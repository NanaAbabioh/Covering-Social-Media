import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/format";
import PostForm, {
  type Grant,
  type ApprovedVideo,
} from "../components/PostForm";
import CourtesyToggle from "../components/CourtesyToggle";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  // Existing posts with their video + permission chain.
  const { data: postsData } = await supabase
    .from("posts")
    .select(
      "*, videos(id,title), outreach(id,ask_type,response,permission_wording,channels(id,name))"
    )
    .order("posted_at", { ascending: false });

  // Grants available to attach a post to (recorded "yes" only).
  const { data: grantsData } = await supabase
    .from("outreach")
    .select("id,ask_type,video_id,channels(id,name),videos(id,title)")
    .eq("response", "yes");

  const { data: approvedVids } = await supabase
    .from("videos")
    .select("id,title,channel_id")
    .eq("status", "approved");

  const grants: Grant[] = (grantsData ?? []).map((g: any) => ({
    id: g.id,
    ask_type: g.ask_type,
    video_id: g.video_id,
    video_title: g.videos?.title ?? null,
    channel_id: g.channels?.id ?? "",
    channel_name: g.channels?.name ?? null,
  }));

  const approvedVideos: ApprovedVideo[] = (approvedVids ?? []) as ApprovedVideo[];
  const posts = (postsData ?? []) as any[];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Posts</h1>
        <p className="text-sm text-slate-500">
          Published reels, each linked to the permission that authorized it.
        </p>
      </div>

      <div className="mb-6">
        <PostForm grants={grants} approvedVideos={approvedVideos} />
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No posts logged yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Posted</th>
                <th className="px-4 py-2">Platform</th>
                <th className="px-4 py-2">Clip</th>
                <th className="px-4 py-2">Permission</th>
                <th className="px-4 py-2">Link</th>
                <th className="px-4 py-2">Courtesy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((p) => {
                const grantYes = p.outreach?.response === "yes";
                const channelName = p.outreach?.channels?.name;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-2 text-slate-600">
                      {formatDate(p.posted_at)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{p.platform ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {p.videos?.title ?? p.video_id ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          grantYes
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {channelName ?? "?"} · {grantYes ? "yes" : p.outreach?.response}
                      </span>
                      {p.outreach?.ask_type === "standing" && (
                        <span className="ml-1 text-xs text-slate-400">(standing)</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {p.post_url ? (
                        <a
                          href={p.post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand hover:underline"
                        >
                          open ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <CourtesyToggle postId={p.id} initial={p.courtesy_notified} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
