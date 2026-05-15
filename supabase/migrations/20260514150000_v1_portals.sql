-- V1 portals: attendees, credit allocations/claims, judges, submission ownership,
-- judging criteria, and per-judge unique scoring.
-- RLS: enabled, no anon/authenticated policies; server writes use SUPABASE_SERVICE_ROLE_KEY
-- (bypasses RLS). Do not expose the service key client-side.

create extension if not exists citext;

-- 1. Attendees / participant allocations (source of truth for who can do what)
-- Populated from Luma (cron / webhook / manual CSV) keyed by (hackathon_id, email).
create table if not exists public.hackathon_attendees (
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  email citext not null,
  first_name text,
  last_name text,
  source text not null default 'manual',          -- 'luma_rsvp' | 'luma_checkin' | 'manual'
  rsvp_at timestamptz,
  checked_in_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (hackathon_id, email)
);

drop trigger if exists hackathon_attendees_set_updated_at on public.hackathon_attendees;
create trigger hackathon_attendees_set_updated_at
  before update on public.hackathon_attendees
  for each row execute procedure public.set_updated_at();

create index if not exists hackathon_attendees_email_idx on public.hackathon_attendees (email);
alter table public.hackathon_attendees enable row level security;

comment on table public.hackathon_attendees is
  'Per-hackathon attendee allocations (Luma RSVP/check-in or manual CSV). One row per (hackathon, email).';

-- 2. Credit allocations: 1 row per (hackathon, email) authorized to claim a credit link.
-- Hard cap is enforced by the PK; the actual credit URL/code lives in Firebase
-- (this row points to it via firebase_doc_path / external_ref).
create table if not exists public.credit_allocations (
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  email citext not null,
  first_name text,
  last_name text,
  amount_usd numeric(10, 2),
  external_ref text,                              -- e.g. Firebase doc id / link key
  firebase_doc_path text,                         -- e.g. credits/<hack>/links/<docId>
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (hackathon_id, email)
);

create index if not exists credit_allocations_email_idx on public.credit_allocations (email);
alter table public.credit_allocations enable row level security;
comment on table public.credit_allocations is
  'Authorized credit claims per (hackathon, email). One row = one credit link.';

-- 3. Credit claims: append-only audit. Unique (hackathon, email) makes double-claim impossible.
create table if not exists public.credit_claims (
  id uuid not null default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  email citext not null,
  claimed_by_user_id uuid,                        -- auth.users.id (Supabase Auth)
  delivered_link text,                            -- final URL handed to the participant
  delivered_code text,                            -- or short code, if that's the format
  ip inet,
  user_agent text,
  claimed_at timestamptz not null default now(),
  primary key (id),
  unique (hackathon_id, email),
  foreign key (hackathon_id, email)
    references public.credit_allocations (hackathon_id, email)
    on delete cascade
);

create index if not exists credit_claims_hackathon_idx on public.credit_claims (hackathon_id);
alter table public.credit_claims enable row level security;
comment on table public.credit_claims is
  'Audit trail of credit deliveries. Unique (hackathon, email) blocks double-claim at the DB level.';

-- 4. Judges: who is allowed to score for a given hackathon.
create table if not exists public.hackathon_judges (
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  email citext not null,
  display_name text,
  user_id uuid,                                    -- auth.users.id once they sign in
  created_at timestamptz not null default now(),
  primary key (hackathon_id, email)
);

alter table public.hackathon_judges enable row level security;
comment on table public.hackathon_judges is
  'Authorized judges per hackathon (email-keyed; user_id filled on first magic-link login).';

-- 5. Judging criteria: per-hackathon (the thematic page sets the rubric).
-- Score storage stays generic: just a numeric value per submission per judge.
create table if not exists public.hackathon_judging_criteria (
  hackathon_id uuid not null primary key references public.hackathons (id) on delete cascade,
  rubric jsonb not null default '{}'::jsonb,       -- e.g. { "max": 10, "criteria": ["impact","craft"] }
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists hackathon_judging_criteria_set_updated_at on public.hackathon_judging_criteria;
create trigger hackathon_judging_criteria_set_updated_at
  before update on public.hackathon_judging_criteria
  for each row execute procedure public.set_updated_at();

alter table public.hackathon_judging_criteria enable row level security;
comment on table public.hackathon_judging_criteria is
  'Per-hackathon judging rubric/notes. Score values themselves stored on judge_scores.';

-- 6. Submissions ownership: tie a submission to the participant who made it.
alter table public.submissions
  add column if not exists submitter_user_id uuid;
alter table public.submissions
  add column if not exists submitter_email citext;

create index if not exists submissions_submitter_email_idx
  on public.submissions (hackathon_id, submitter_email);

-- 7. Judge scores: link to judge user + unique (submission, judge_user).
alter table public.judge_scores
  add column if not exists judge_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.judge_scores'::regclass
      and conname = 'judge_scores_unique_per_judge'
  ) then
    alter table public.judge_scores
      add constraint judge_scores_unique_per_judge
      unique (submission_id, judge_user_id);
  end if;
end $$;

comment on column public.judge_scores.judge_user_id is
  'auth.users.id of the judge that submitted the score (filled on first magic-link login).';
