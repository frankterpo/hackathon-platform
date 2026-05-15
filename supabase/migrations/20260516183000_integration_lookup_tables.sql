-- Normalized integration identifiers: canonical rows in tall tables, hackathons FK.
--
-- PostgREST embeds from the app (hackathons → luma_events / firebase_projects) require the
-- FK constraints below. If the API returns "Could not find a relationship … schema cache",
-- apply this file to the linked project: `supabase link` then `npm run supabase:push`.
--
-- FK ON DELETE: RESTRICT for both lookups so DELETE on luma_events / firebase_projects fails
-- while any hackathons row still references that id. Clearing a hackathon link is UPDATE … SET …_uuid NULL
-- first; avoids silent orphan FKs / accidental removal of shared integration rows still in use.
--
-- Legacy text columns hackathons.luma_event_id / hackathons.firebase_config_ref remain (backfilled alongside
-- FK UUIDs); a follow-up PR can drop duplication once all writers read the FK joins.
--
-- ROLLBACK (manual; only if no code depends on new columns):
--   alter table public.hackathons drop constraint if exists hackathons_luma_event_uuid_fkey;
--   alter table public.hackathons drop constraint if exists hackathons_firebase_project_uuid_fkey;
--   drop index if exists public.hackathons_luma_event_uuid_key;
--   alter table public.hackathons drop column if exists luma_event_uuid;
--   alter table public.hackathons drop column if exists firebase_project_uuid;
--   drop trigger if exists luma_events_set_updated_at on public.luma_events;
--   drop trigger if exists firebase_projects_set_updated_at on public.firebase_projects;
--   drop table if exists public.luma_events cascade;
--   drop table if exists public.firebase_projects cascade;

-- ---------------------------------------------------------------------------
-- 1. Lookup tables
-- ---------------------------------------------------------------------------
create table if not exists public.luma_events (
  id uuid primary key default gen_random_uuid(),
  luma_event_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint luma_events_luma_event_id_key unique (luma_event_id)
);

comment on table public.luma_events is
  'Canonical Luma event API ids; grows as new events link to hackathons.';
comment on column public.luma_events.luma_event_id is
  'Luma event identifier (distinct per event), same value previously stored on hackathons.luma_event_id.';

create table if not exists public.firebase_projects (
  id uuid primary key default gen_random_uuid(),
  firebase_project_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firebase_projects_firebase_project_id_key unique (firebase_project_id)
);

comment on table public.firebase_projects is
  'Firebase / Google Cloud project identifiers used by hackathons (formerly hackathons.firebase_config_ref).';

drop trigger if exists luma_events_set_updated_at on public.luma_events;
create trigger luma_events_set_updated_at
  before update on public.luma_events
  for each row execute procedure public.set_updated_at();

drop trigger if exists firebase_projects_set_updated_at on public.firebase_projects;
create trigger firebase_projects_set_updated_at
  before update on public.firebase_projects
  for each row execute procedure public.set_updated_at();

alter table public.luma_events enable row level security;
alter table public.firebase_projects enable row level security;
-- No anon/authenticated policies: server writes use SUPABASE_SERVICE_ROLE_KEY (consistent with portals).

-- ---------------------------------------------------------------------------
-- 2. Backfill lookups from hackathons (distinct natural keys only)
-- ---------------------------------------------------------------------------
insert into public.luma_events (luma_event_id, display_name)
select lei,
       max(title) filter (where title is not null)
from (
  select trim(h.luma_event_id) as lei,
         nullif(trim(h.luma_event_title), '') as title
  from public.hackathons h
  where nullif(trim(h.luma_event_id), '') is not null
) m
group by lei
on conflict (luma_event_id) do nothing;

insert into public.firebase_projects (firebase_project_id, display_name)
select distinct trim(h.firebase_config_ref), null
from public.hackathons h
where nullif(trim(h.firebase_config_ref), '') is not null
on conflict (firebase_project_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. FK columns + backfill on hackathons, then FK constraints + uniqueness
-- ---------------------------------------------------------------------------
alter table public.hackathons add column if not exists luma_event_uuid uuid;
alter table public.hackathons add column if not exists firebase_project_uuid uuid;

update public.hackathons h
set luma_event_uuid = le.id
from public.luma_events le
where nullif(trim(h.luma_event_id), '') is not null
  and le.luma_event_id = trim(h.luma_event_id)
  and (h.luma_event_uuid is distinct from le.id);

update public.hackathons h
set firebase_project_uuid = fp.id
from public.firebase_projects fp
where nullif(trim(h.firebase_config_ref), '') is not null
  and fp.firebase_project_id = trim(h.firebase_config_ref)
  and (h.firebase_project_uuid is distinct from fp.id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hackathons_luma_event_uuid_fkey'
  ) then
    alter table public.hackathons
      add constraint hackathons_luma_event_uuid_fkey
      foreign key (luma_event_uuid) references public.luma_events (id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'hackathons_firebase_project_uuid_fkey'
  ) then
    alter table public.hackathons
      add constraint hackathons_firebase_project_uuid_fkey
      foreign key (firebase_project_uuid) references public.firebase_projects (id) on delete restrict;
  end if;
end $$;

-- One hackathon per Luma event (same semantics as partial unique on hackathons.luma_event_id).
create unique index if not exists hackathons_luma_event_uuid_key
  on public.hackathons (luma_event_uuid)
  where luma_event_uuid is not null;

comment on column public.hackathons.luma_event_uuid is
  'FK to public.luma_events; legacy hackathons.luma_event_id kept for rollout.';
comment on column public.hackathons.firebase_project_uuid is
  'FK to public.firebase_projects; legacy hackathons.firebase_config_ref kept for rollout.';
