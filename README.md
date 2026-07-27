# The Covering — Content Pipeline

A permission-first content pipeline + CRM for discovering human-made YouTube
videos about **Christian parenting & prayer**, reviewing the best ones, and
managing creator outreach so short clips can be repurposed into social reels
**only after a recorded "yes."**

> Workflow rule (enforced): **discover → identify clip → ask permission → only on a yes: post.**
> Credit is not permission. A post cannot be recorded in the DB without a linked
> outreach grant marked `yes` (enforced by a Postgres trigger).

## Stack
- **Next.js 14 (App Router) + TypeScript + Tailwind** on Vercel
- **Supabase (Postgres)** — all access is server-side via the `service_role` key; RLS is on with no public policies
- **Vercel Cron** — daily YouTube search + daily RSS poll of approved channels
- **YouTube Data API v3** (free tier: 10,000 units/day; search = 100 units)

## Pages
- `/` **Review Queue** — capped, ranked candidates with embedded player, channel stats, score signal breakdown ("why"), red-flag badges, and Approve / Maybe / Reject. Approving captures the clip moment and promotes the channel (enables RSS).
- `/creators` **Creators / CRM** — approved channels, contact info, outreach asks, and recorded permission grants (exact wording + date).
- `/posts` **Posts** — published reels, each linked to its permission grant; courtesy-notified checkbox.
- `/settings` **Settings** — edit search queries, scoring weights/thresholds, queue cap; "Run discovery now."

## Local development
1. `npm install`
2. Copy env: `cp .env.local.example .env.local` and fill in:
   - `YOUTUBE_API_KEY` — Google Cloud Console → APIs & Services → Credentials
   - `SUPABASE_URL` — `https://ouuokhwfsfphqzalovvu.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → `service_role` (secret)
   - `CRON_SECRET` — any long random string (`openssl rand -hex 32`)
3. `npm run dev` → http://localhost:3000
4. Trigger discovery manually from **Settings → Run discovery now**, or:
   ```bash
   curl -X POST "http://localhost:3000/api/admin/run-discovery?secret=YOUR_CRON_SECRET"
   ```

## Database
Schema lives in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql):
`search_queries`, `channels`, `videos`, `outreach`, `posts`, `app_settings`.
It seeds the 10 starter queries and a default `app_settings` row.

## Deploy (Vercel)
1. Import the GitHub repo into Vercel (project: **covering-social-media**).
2. Set the same env vars in **Project → Settings → Environment Variables**
   (`YOUTUBE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`).
3. **Protect the app**: Project → Settings → Deployment Protection → enable
   password protection (holds private CRM data).
4. Cron jobs are declared in [`vercel.json`](vercel.json) (daily). Vercel injects
   `CRON_SECRET` as a Bearer token automatically; the routes reject anything else.

## Quota math
~10 active queries × 2 passes (relevance + date) = ~2,000 units/day for search,
well under the 10,000/day free quota. RSS polling of approved channels is free
(only the `videos.list` detail lookups cost ~1 unit each).
