-- =============================================================================
-- The Covering — Content Pipeline: initial schema
-- Permission-first YouTube discovery / review / outreach CRM.
--
-- Design notes:
--   * All app DB access is server-side via the service_role key, which BYPASSES
--     RLS. We still ENABLE RLS on every table with no public policies, so the
--     anon/publishable key can never read or write these tables directly.
--   * The permission-first rule is enforced in the DB by a trigger: a `posts`
--     row cannot exist unless its linked `outreach` row has response = 'yes'.
-- =============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- search_queries: editable YouTube search terms driving daily discovery
-- -----------------------------------------------------------------------------
create table if not exists public.search_queries (
  id           uuid primary key default gen_random_uuid(),
  query_text   text not null unique,
  active       boolean not null default true,
  last_run_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- channels: YouTube channels we've discovered / are tracking
-- -----------------------------------------------------------------------------
create table if not exists public.channels (
  id                    text primary key,               -- YouTube channel ID
  name                  text,
  url                   text,
  subscriber_count      bigint,
  video_count           bigint,
  channel_published_at  timestamptz,                    -- channel creation date (age)
  upload_frequency      numeric,                        -- uploads per week (approx)
  first_seen            timestamptz not null default now(),
  status                text not null default 'candidate'
                          check (status in ('candidate','approved','rejected')),
  rss_monitored         boolean not null default false,
  contact_email         text,
  website               text
);

-- -----------------------------------------------------------------------------
-- videos: discovered videos, scored + queued for human review
-- -----------------------------------------------------------------------------
create table if not exists public.videos (
  id                text primary key,                   -- YouTube video ID
  channel_id        text references public.channels(id),
  title             text,
  description       text,
  published_at      timestamptz,
  duration          text,                               -- ISO 8601 (e.g. PT5M30S)
  view_count        bigint,
  comment_count     bigint,
  discovered_at     timestamptz not null default now(),
  discovery_source  text check (discovery_source in ('search','rss')),
  score             numeric,
  score_signals     jsonb,
  status            text not null default 'suppressed'
                      check (status in ('queued','approved','rejected','maybe','suppressed')),
  clip_timestamp    text,
  clip_note         text
);

create index if not exists videos_status_score_idx
  on public.videos (status, score desc);
create index if not exists videos_channel_idx
  on public.videos (channel_id);

-- -----------------------------------------------------------------------------
-- outreach: permission asks + recorded grants (the CRM heart)
-- -----------------------------------------------------------------------------
create table if not exists public.outreach (
  id                  uuid primary key default gen_random_uuid(),
  channel_id          text not null references public.channels(id),
  video_id            text references public.videos(id),   -- null = standing ask
  asked_at            timestamptz,
  ask_type            text not null default 'one_time'
                        check (ask_type in ('one_time','standing')),
  response            text not null default 'pending'
                        check (response in ('pending','yes','no','revoked')),
  response_at         timestamptz,
  permission_wording  text,                                -- exact grant language
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists outreach_channel_idx on public.outreach (channel_id);
create index if not exists outreach_response_idx on public.outreach (response);

-- -----------------------------------------------------------------------------
-- posts: published reels, each provably backed by a permission grant
-- -----------------------------------------------------------------------------
create table if not exists public.posts (
  id                uuid primary key default gen_random_uuid(),
  video_id          text references public.videos(id),
  outreach_id       uuid not null references public.outreach(id),  -- proof of permission
  platform          text,
  posted_at         timestamptz,
  post_url          text,
  courtesy_notified boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists posts_video_idx on public.posts (video_id);

-- -----------------------------------------------------------------------------
-- Permission-first integrity: a post's linked outreach MUST be a recorded 'yes'
-- -----------------------------------------------------------------------------
create or replace function public.enforce_post_permission()
returns trigger
language plpgsql
as $$
declare
  grant_response text;
begin
  select response into grant_response
  from public.outreach
  where id = new.outreach_id;

  if grant_response is null then
    raise exception 'posts.outreach_id % does not reference a valid outreach row', new.outreach_id;
  end if;

  if grant_response <> 'yes' then
    raise exception
      'Cannot record a post: linked outreach (%) has response=%, but a recorded "yes" is required.',
      new.outreach_id, grant_response;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_require_permission on public.posts;
create trigger posts_require_permission
  before insert or update on public.posts
  for each row execute function public.enforce_post_permission();

-- -----------------------------------------------------------------------------
-- app_settings: single-row config (queue cap, scoring, lookback)
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id      int primary key default 1 check (id = 1),
  config  jsonb not null
);

-- -----------------------------------------------------------------------------
-- Row Level Security: lock everything down (service_role bypasses RLS)
-- -----------------------------------------------------------------------------
alter table public.search_queries enable row level security;
alter table public.channels       enable row level security;
alter table public.videos         enable row level security;
alter table public.outreach       enable row level security;
alter table public.posts          enable row level security;
alter table public.app_settings   enable row level security;

-- -----------------------------------------------------------------------------
-- Seed data
-- -----------------------------------------------------------------------------
insert into public.search_queries (query_text) values
  ('praying over your children'),
  ('teaching kids to pray'),
  ('family devotional'),
  ('raising godly kids'),
  ('prayer for my child'),
  ('Christian parenting prayer'),
  ('praying scripture over kids'),
  ('bedtime prayer routine kids'),
  ('how to pray with your children'),
  ('Christian motherhood prayer')
on conflict (query_text) do nothing;

insert into public.app_settings (id, config) values (
  1,
  jsonb_build_object(
    'queue_cap', 15,
    'lookback_days', 30,
    'weights', jsonb_build_object(
      'cadence',      25,
      'longevity',    15,
      'engagement',   20,
      'website',      15,
      'description',  10,
      'relevance',    15
    ),
    'thresholds', jsonb_build_object(
      'farm_uploads_per_week', 5,     -- >= this uploads/week is penalized as a content farm
      'good_uploads_per_week', 1.5,   -- ~weekly cadence is ideal
      'min_channel_age_days',  180    -- younger channels get a longevity penalty
    )
  )
)
on conflict (id) do nothing;
