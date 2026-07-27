"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Grant = {
  id: string;
  ask_type: string;
  video_id: string | null;
  video_title: string | null;
  channel_id: string;
  channel_name: string | null;
};

export type ApprovedVideo = { id: string; title: string | null; channel_id: string };

/**
 * Create a post. You can ONLY pick from outreach grants already marked "yes",
 * so a post is always backed by permission. For standing grants (no specific
 * clip) you choose which approved video the post uses.
 */
export default function PostForm({
  grants,
  approvedVideos,
}: {
  grants: Grant[];
  approvedVideos: ApprovedVideo[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [grantId, setGrantId] = useState(grants[0]?.id ?? "");
  const [videoId, setVideoId] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [postUrl, setPostUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grant = grants.find((g) => g.id === grantId);
  const needsVideoPick = grant && !grant.video_id; // standing grant
  const channelVideos = grant
    ? approvedVideos.filter((v) => v.channel_id === grant.channel_id)
    : [];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const finalVideoId = grant?.video_id ?? (videoId || null);
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outreach_id: grantId,
          video_id: finalVideoId,
          platform,
          post_url: postUrl || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setOpen(false);
      setPostUrl("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (grants.length === 0) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
        No permissions on file yet. Record a <strong>yes</strong> in{" "}
        <a href="/creators" className="underline">
          Creators / CRM
        </a>{" "}
        before logging a post.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        + Log a published post
      </button>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="text-xs text-slate-500">Permission grant</span>
          <select
            value={grantId}
            onChange={(e) => setGrantId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          >
            {grants.map((g) => (
              <option key={g.id} value={g.id}>
                {g.channel_name ?? g.channel_id} —{" "}
                {g.ask_type === "standing"
                  ? "standing permission"
                  : g.video_title ?? "one-time clip"}
              </option>
            ))}
          </select>
        </label>

        {needsVideoPick && (
          <label className="flex flex-col text-sm sm:col-span-2">
            <span className="text-xs text-slate-500">Which approved clip?</span>
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="">— select —</option>
              {channelVideos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title?.slice(0, 60) ?? v.id}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col text-sm">
          <span className="text-xs text-slate-500">Platform</span>
          <input
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-xs text-slate-500">Post URL</span>
          <input
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://instagram.com/p/…"
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || (needsVideoPick && !videoId)}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save post"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
