# Handoff: Christian Parenting Prayer — Content Pipeline Web App

## Who I am and what this is for
I run a mobile app that helps Christian parents consistently and intentionally pray for their children. To grow it, I'm building a content pipeline that discovers human-made YouTube videos about parenting and prayer (Christian faith only), helps me review the best ones, and manages creator outreach so I can repurpose short clips **with explicit permission** into social reels (e.g., Instagram carousel: slide 1 = credited clip, slide 2 = my commentary/app intro).

## Non-negotiable workflow rule (permission-first)
The pipeline enforces this order: **discover → identify clip moment → ask creator for permission → only on a yes: edit and post.**
- Credit is not permission. Never post before a recorded yes.
- Permissions are either **one-time** (that clip only) or **standing** (ongoing excerpts). Log the exact wording and date of every grant.
- Silence after ~1 week = no. Revocations honored same-day.
- If use changes (e.g., organic post → paid ad), re-ask.

## Stack (already decided)
- **Next.js on Vercel** — UI + serverless API routes. My Vercel account is connected.
- **Supabase (Postgres)** — my account is connected.
- **Vercel Cron** — daily job for YouTube API search; second job polling RSS feeds of approved channels.
- **YouTube Data API v3** — free tier (10,000 units/day; search = 100 units). API key as env var `YOUTUBE_API_KEY`. I still need to create this key in Google Cloud Console — remind me.
- **Channel RSS** (no quota): `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID` for approved channels.

## Database schema (draft — refine as needed)
- `search_queries` — id, query_text, active, last_run_at
- `videos` — id (YouTube video ID, PK), channel_id, title, description, published_at, duration, view_count, discovered_at, discovery_source (search|rss), score, score_signals (jsonb), status (queued|approved|rejected|maybe|suppressed), clip_timestamp, clip_note
- `channels` — id (YouTube channel ID, PK), name, url, subscriber_count, upload_frequency, first_seen, status (candidate|approved|rejected), rss_monitored (bool), contact_email, website
- `outreach` — id, channel_id, video_id (nullable for standing asks), asked_at, ask_type (one_time|standing), response (pending|yes|no|revoked), response_at, permission_wording (text — exact grant language), notes
- `posts` — id, video_id, outreach_id (FK proving permission), platform, posted_at, post_url, courtesy_notified (bool)

Key integrity idea: a post should reference a valid permission record. Consider making it impossible to mark a post "published" without a linked `outreach` row with response=yes.

## Pipeline stages
1. **Discovery (daily cron):** run active queries via YouTube search API, two passes each (order=relevance and order=date), with `publishedAfter` = last run. ~10 queries ≈ 1,000–2,000 units/day, well under quota.
2. **Dedupe:** skip any video ID already in `videos`.
3. **Auto-scoring (quality over quantity):** compute signals from API data:
   - Channel upload cadence (≈weekly good; 5+/week = likely content farm → penalize heavily)
   - Channel age and longevity
   - Comments-to-views engagement ratio
   - Real ministry/personal website linked in channel/description
   - Description depth (not keyword-stuffed boilerplate)
   - Keyword relevance in title/description
   Store per-video signal breakdown in `score_signals` so the review UI can show WHY something scored well.
4. **Queue cap:** only the top ~10–15 new candidates per week reach my review queue. Everything else stays in DB as suppressed (searchable later, never cluttering review).
5. **Human review UI:** embedded player, channel stats, score signals; buttons approve / reject / maybe. Approve prompts for clip timestamp + one line on why it's powerful (feeds the outreach email).
6. **Channel promotion:** approving a video promotes its channel to `approved` and enables RSS monitoring, so future uploads arrive quota-free.
7. **Outreach CRM:** per-creator view: contact info, asks sent, permission status/type/wording, linked posts. Statuses drive what I'm allowed to do next.
8. **Posts tracker:** published reels linked to their permission record; courtesy-notification checkbox for standing-permission posts.

## Seed search queries (Christian faith scope)
- praying over your children
- teaching kids to pray
- family devotional
- raising godly kids
- prayer for my child
- Christian parenting prayer
- praying scripture over kids
- bedtime prayer routine kids
- how to pray with your children
- Christian motherhood prayer

Queries must be editable in a Settings page (no code changes needed).

## Human-made filter (this niche is heavily AI-farmed)
Auto-scoring handles triage, but the review UI should surface red flags: very high upload frequency, comments disabled, generic thumbnails across unrelated topics, stock-footage + synthetic voiceover patterns. Final call is mine in review.

## Pages
1. **Review queue** (default landing) — capped, ranked, signal explanations visible
2. **Creators / CRM** — outreach + permissions log
3. **Posts** — published content with permission linkage
4. **Settings** — query list, scoring thresholds, queue cap

## Suggested build order
1. Supabase schema + seed queries
2. Discovery cron route (search → dedupe → score → store), test manually first
3. Review queue UI
4. Approve flow + channel promotion + RSS cron
5. Outreach CRM
6. Posts tracker + Settings
7. Deploy on Vercel with cron config

## Later / explicitly out of scope for v1
- Drafting the permission email templates (I'll do this with Claude separately — two-tier ask: specific clip + optional standing arrangement)
- Any video downloading or editing inside this app — it's a discovery/review/CRM tool only
- Paid-ads workflows

## Env vars
- `YOUTUBE_API_KEY`
- Supabase URL + keys (via integration)
