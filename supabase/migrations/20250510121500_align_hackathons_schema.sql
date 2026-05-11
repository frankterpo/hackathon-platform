-- Align older / partial public.hackathons with platform schema (idempotent).
-- Safe when 20250510120000 ran on an empty DB (no-ops) or when remote had a pre-existing table
-- without status / submissions (ADD COLUMN IF NOT EXISTS).

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hackathon_status') then
    create type public.hackathon_status as enum ('live', 'scheduled', 'completed');
  end if;
end $$;

create table if not exists public.hackathons (
  id uuid primary key default gen_random_uuid()
);

alter table public.hackathons add column if not exists name text;
alter table public.hackathons add column if not exists status public.hackathon_status;
alter table public.hackathons add column if not exists start_date timestamptz;
alter table public.hackathons add column if not exists end_date timestamptz;
alter table public.hackathons add column if not exists theme_slug text;
alter table public.hackathons add column if not exists vercel_project_slug text;
alter table public.hackathons add column if not exists luma_event_id text;
alter table public.hackathons add column if not exists firebase_config_ref text;
alter table public.hackathons add column if not exists created_at timestamptz;
alter table public.hackathons add column if not exists updated_at timestamptz;

update public.hackathons
set
  name = coalesce(nullif(trim(name), ''), 'Legacy hackathon'),
  status = coalesce(status, 'scheduled'::public.hackathon_status),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where true;

alter table public.hackathons alter column name set not null;
alter table public.hackathons alter column status set not null;
alter table public.hackathons alter column status set default 'scheduled'::public.hackathon_status;
alter table public.hackathons alter column created_at set not null;
alter table public.hackathons alter column created_at set default now();
alter table public.hackathons alter column updated_at set not null;
alter table public.hackathons alter column updated_at set default now();

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
  for each row execute function public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

alter table public.hackathons enable row level security;
alter table public.submissions enable row level security;
alter table public.judge_scores enable row level security;
