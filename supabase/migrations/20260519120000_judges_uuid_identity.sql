-- Canonical judge identities: one UUID per distinct email (citext).
-- judge_scores.judge_email / hackathon_judges.email continue to hold the human-readable key;
-- judge_id links rows to public.judges for stable joins across hackathons.

create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  created_at timestamptz not null default now()
);

comment on table public.judges is
  'Stable judge identity: one UUID per distinct email (cross-hackathon).';

alter table public.judges enable row level security;

insert into public.judges (email)
select distinct trim(js.judge_email::text)::citext
from public.judge_scores js
where js.judge_email is not null and trim(js.judge_email::text) <> ''
on conflict (email) do nothing;

insert into public.judges (email)
select distinct hj.email
from public.hackathon_judges hj
where hj.email is not null and trim(hj.email::text) <> ''
on conflict (email) do nothing;

alter table public.judge_scores
  add column if not exists judge_id uuid references public.judges (id) on delete restrict;

alter table public.hackathon_judges
  add column if not exists judge_id uuid references public.judges (id) on delete restrict;

update public.judge_scores js
set judge_id = j.id
from public.judges j
where js.judge_email is not null
  and trim(js.judge_email::text) <> ''
  and j.email = trim(js.judge_email::text)::citext
  and js.judge_id is null;

update public.hackathon_judges hj
set judge_id = j.id
from public.judges j
where hj.email is not null
  and trim(hj.email::text) <> ''
  and j.email = hj.email
  and hj.judge_id is null;

create index if not exists judge_scores_judge_id_idx
  on public.judge_scores (judge_id);

create index if not exists hackathon_judges_judge_id_idx
  on public.hackathon_judges (judge_id);

create or replace function public.ensure_judge_id_for_email(em citext)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
begin
  if em is null or btrim(em::text) = '' then
    return null;
  end if;
  insert into public.judges (email)
  values (btrim(em::text)::citext)
  on conflict (email) do nothing;
  select id into jid from public.judges where email = btrim(em::text)::citext limit 1;
  return jid;
end;
$$;

comment on function public.ensure_judge_id_for_email(citext) is
  'Insert-if-missing judges row by email and return id (SECURITY DEFINER so triggers work under RLS).';

revoke all on function public.ensure_judge_id_for_email(citext) from public;

create or replace function public.trg_judge_scores_set_judge_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.judge_email is not null and btrim(new.judge_email::text) <> '' then
    new.judge_id :=
      public.ensure_judge_id_for_email(btrim(new.judge_email::text)::citext);
  else
    new.judge_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists judge_scores_set_judge_id on public.judge_scores;
create trigger judge_scores_set_judge_id
  before insert or update of judge_email on public.judge_scores
  for each row
  execute procedure public.trg_judge_scores_set_judge_id();

create or replace function public.trg_hackathon_judges_set_judge_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and btrim(new.email::text) <> '' then
    new.judge_id :=
      public.ensure_judge_id_for_email(btrim(new.email::text)::citext);
  else
    new.judge_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists hackathon_judges_set_judge_id on public.hackathon_judges;
create trigger hackathon_judges_set_judge_id
  before insert or update of email on public.hackathon_judges
  for each row
  execute procedure public.trg_hackathon_judges_set_judge_id();

comment on column public.judge_scores.judge_id is
  'Stable judge identity (public.judges.id); assigned from judge_email.';

comment on column public.hackathon_judges.judge_id is
  'Stable judge identity (public.judges.id); assigned from email.';
