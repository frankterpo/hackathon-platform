-- Master hackathon platform: core tables (shared Supabase, per-hack Vercel/Luma/Firebase)

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hackathon_status') then
    create type public.hackathon_status as enum ('live', 'scheduled', 'completed');
  end if;
end $$;

create table if not exists public.hackathons (
  id uuid default gen_random_uuid()
);

alter table public.hackathons add column if not exists id uuid;
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
  id = coalesce(id, gen_random_uuid()),
  name = coalesce(nullif(trim(name), ''), 'Legacy hackathon'),
  status = coalesce(status, 'scheduled'::public.hackathon_status),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where id is null
  or name is null
  or nullif(trim(name), '') is null
  or status is null
  or created_at is null
  or updated_at is null;

alter table public.hackathons alter column id set default gen_random_uuid();
alter table public.hackathons alter column id set not null;
alter table public.hackathons alter column name set not null;
alter table public.hackathons alter column status set not null;
alter table public.hackathons alter column status set default 'scheduled'::public.hackathon_status;
alter table public.hackathons alter column created_at set not null;
alter table public.hackathons alter column created_at set default now();
alter table public.hackathons alter column updated_at set not null;
alter table public.hackathons alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hackathons'::regclass
      and contype = 'p'
  ) then
    alter table public.hackathons add constraint hackathons_pkey primary key (id);
  end if;
end $$;

create unique index if not exists hackathons_id_key on public.hackathons (id);

create table if not exists public.submissions (
  id uuid default gen_random_uuid()
);

alter table public.submissions add column if not exists id uuid;
alter table public.submissions add column if not exists hackathon_id uuid;
alter table public.submissions add column if not exists title text;
alter table public.submissions add column if not exists body text;
alter table public.submissions add column if not exists team_name text;
alter table public.submissions add column if not exists repo_url text;
alter table public.submissions add column if not exists created_at timestamptz;
alter table public.submissions add column if not exists updated_at timestamptz;

update public.submissions
set
  id = coalesce(id, gen_random_uuid()),
  title = coalesce(nullif(trim(title), ''), 'Legacy submission'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where id is null
  or title is null
  or nullif(trim(title), '') is null
  or created_at is null
  or updated_at is null;

alter table public.submissions alter column id set default gen_random_uuid();
alter table public.submissions alter column id set not null;
alter table public.submissions alter column title set not null;
alter table public.submissions alter column created_at set not null;
alter table public.submissions alter column created_at set default now();
alter table public.submissions alter column updated_at set not null;
alter table public.submissions alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.submissions'::regclass
      and contype = 'p'
  ) then
    alter table public.submissions add constraint submissions_pkey primary key (id);
  end if;
end $$;

create unique index if not exists submissions_id_key on public.submissions (id);

do $$
begin
  if exists (
    select 1 from public.submissions where hackathon_id is null
  ) then
    raise notice 'public.submissions has rows without hackathon_id; leaving column nullable until data is backfilled.';
  else
    alter table public.submissions alter column hackathon_id set not null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.submissions'::regclass
      and conname = 'submissions_hackathon_id_fkey'
  ) then
    alter table public.submissions
      add constraint submissions_hackathon_id_fkey
      foreign key (hackathon_id) references public.hackathons (id) on delete cascade;
  end if;
end $$;

create table if not exists public.judge_scores (
  id uuid default gen_random_uuid()
);

alter table public.judge_scores add column if not exists id uuid;
alter table public.judge_scores add column if not exists submission_id uuid;
alter table public.judge_scores add column if not exists judge_email text;
alter table public.judge_scores add column if not exists score numeric;
alter table public.judge_scores add column if not exists notes text;
alter table public.judge_scores add column if not exists created_at timestamptz;

update public.judge_scores
set
  id = coalesce(id, gen_random_uuid()),
  created_at = coalesce(created_at, now())
where id is null
  or created_at is null;

alter table public.judge_scores alter column id set default gen_random_uuid();
alter table public.judge_scores alter column id set not null;
alter table public.judge_scores alter column created_at set not null;
alter table public.judge_scores alter column created_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.judge_scores'::regclass
      and contype = 'p'
  ) then
    alter table public.judge_scores add constraint judge_scores_pkey primary key (id);
  end if;

  if exists (
    select 1 from public.judge_scores where submission_id is null or score is null
  ) then
    raise notice 'public.judge_scores has rows without submission_id or score; leaving required columns nullable until data is backfilled.';
  else
    alter table public.judge_scores alter column submission_id set not null;
    alter table public.judge_scores alter column score set not null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.judge_scores'::regclass
      and conname = 'judge_scores_submission_id_fkey'
  ) then
    alter table public.judge_scores
      add constraint judge_scores_submission_id_fkey
      foreign key (submission_id) references public.submissions (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.judge_scores'::regclass
      and conname = 'judge_scores_score_check'
  ) then
    alter table public.judge_scores
      add constraint judge_scores_score_check check (score >= 0 and score <= 100);
  end if;
end $$;

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
