-- Master hackathon platform: core tables (shared Supabase, per-hack Vercel/Luma/Firebase)

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hackathon_status') then
    create type public.hackathon_status as enum ('live', 'scheduled', 'completed');
  end if;
end $$;

create table if not exists public.hackathons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.hackathon_status not null default 'scheduled',
  start_date timestamptz,
  end_date timestamptz,
  theme_slug text,
  vercel_project_slug text,
  luma_event_id text,
  firebase_config_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  title text not null,
  body text,
  team_name text,
  repo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.judge_scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  judge_email text,
  score numeric not null check (score >= 0 and score <= 100),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists submissions_hackathon_id_idx on public.submissions (hackathon_id);
create index if not exists judge_scores_submission_id_idx on public.judge_scores (submission_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hackathons_set_updated_at on public.hackathons;
create trigger hackathons_set_updated_at
  before update on public.hackathons
  for each row execute procedure public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute procedure public.set_updated_at();

alter table public.hackathons enable row level security;
alter table public.submissions enable row level security;
alter table public.judge_scores enable row level security;

-- JWT / anon policies are omitted: use SUPABASE_SERVICE_ROLE_KEY on the server
-- to read/write from Next.js, or add policies for authenticated roles later.
-- After linking, run `supabase db pull` to reconcile remote schema changes.

comment on table public.hackathons is 'One row per hackathon event; theme varies per Vercel deployment.';
comment on table public.submissions is 'Participant submissions for a hackathon.';
comment on table public.judge_scores is 'Per-judge scores for a submission.';
