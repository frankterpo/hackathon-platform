-- Hackathon-scoped operational tasks + stub agent_runs (no runners in V1).
-- RLS: same convention as public.hackathons — enabled, no anon/authenticated policies;
-- server writes use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Do not expose that key client-side.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hackathon_task_type') then
    create type public.hackathon_task_type as enum (
      'venue',
      'catering',
      'luma_copy',
      'code',
      'judges',
      'partners',
      'social',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hackathon_task_status') then
    create type public.hackathon_task_status as enum (
      'todo',
      'in_progress',
      'done',
      'blocked'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_run_state') then
    create type public.agent_run_state as enum (
      'draft',
      'awaiting_approval',
      'approved',
      'rejected'
    );
  end if;
end $$;

create table if not exists public.hackathon_tasks (
  id uuid default gen_random_uuid() not null,
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  title text not null,
  task_type public.hackathon_task_type not null default 'other',
  status public.hackathon_task_status not null default 'todo',
  sort_order integer not null default 0,
  notes text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hackathon_tasks'::regclass
      and contype = 'p'
  ) then
    alter table public.hackathon_tasks add constraint hackathon_tasks_pkey primary key (id);
  end if;
end $$;

create index if not exists hackathon_tasks_hackathon_sort_idx
  on public.hackathon_tasks (hackathon_id, sort_order);

drop trigger if exists hackathon_tasks_set_updated_at on public.hackathon_tasks;
create trigger hackathon_tasks_set_updated_at
  before update on public.hackathon_tasks
  for each row execute procedure public.set_updated_at();

alter table public.hackathon_tasks enable row level security;

comment on table public.hackathon_tasks is 'Operational checklist items per hackathon (venue, catering, comms, etc.).';

-- Stub for future human-in-the-loop / agent drafts (no email, no external runners in V1).
create table if not exists public.agent_runs (
  id uuid default gen_random_uuid() not null,
  hackathon_task_id uuid references public.hackathon_tasks (id) on delete set null,
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  intent text not null default '',
  output_draft text not null default '',
  state public.agent_run_state not null default 'draft',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agent_runs'::regclass
      and contype = 'p'
  ) then
    alter table public.agent_runs add constraint agent_runs_pkey primary key (id);
  end if;
end $$;

create index if not exists agent_runs_hackathon_id_idx on public.agent_runs (hackathon_id);
create index if not exists agent_runs_hackathon_task_id_idx on public.agent_runs (hackathon_task_id);

alter table public.agent_runs enable row level security;

comment on table public.agent_runs is 'Stub for agent/tool outputs pending approval; not wired to runners in V1.';

-- JWT / anon policies omitted: use SUPABASE_SERVICE_ROLE_KEY on the server
-- to read/write from Next.js, or add policies for authenticated roles later.
