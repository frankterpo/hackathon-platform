-- Keep legacy public.hackathons.starts_at / ends_at compatible with start_date / end_date.
-- Some linked projects still require starts_at to be NOT NULL, so preserve and populate it.

alter table public.hackathons add column if not exists starts_at timestamptz;
alter table public.hackathons add column if not exists ends_at timestamptz;

update public.hackathons
set
  start_date = coalesce(start_date, starts_at, created_at, now()),
  end_date = coalesce(end_date, ends_at, start_date, starts_at, created_at, now()),
  starts_at = coalesce(starts_at, start_date, created_at, now()),
  ends_at = coalesce(ends_at, end_date, start_date, starts_at, created_at, now())
where start_date is null
  or end_date is null
  or starts_at is null
  or ends_at is null;

create or replace function public.set_hackathon_legacy_fields()
returns trigger
language plpgsql
as $$
declare
  fallback_slug text;
begin
  fallback_slug := coalesce(
    public.normalize_hackathon_slug(new.name),
    'hackathon'
  ) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  new.theme_slug := coalesce(nullif(trim(new.theme_slug), ''), nullif(trim(new.slug), ''), fallback_slug);
  new.slug := coalesce(nullif(trim(new.slug), ''), nullif(trim(new.theme_slug), ''), fallback_slug);

  new.start_date := coalesce(new.start_date, new.starts_at, now());
  new.starts_at := coalesce(new.starts_at, new.start_date, now());
  new.end_date := coalesce(new.end_date, new.ends_at, new.start_date, new.starts_at, now());
  new.ends_at := coalesce(new.ends_at, new.end_date, new.start_date, new.starts_at, now());

  return new;
end;
$$;

drop trigger if exists hackathons_set_slugs on public.hackathons;
drop trigger if exists hackathons_set_legacy_fields on public.hackathons;
create trigger hackathons_set_legacy_fields
  before insert or update on public.hackathons
  for each row execute function public.set_hackathon_legacy_fields();

alter table public.hackathons alter column starts_at set not null;
alter table public.hackathons alter column starts_at set default now();
alter table public.hackathons alter column ends_at set not null;
alter table public.hackathons alter column ends_at set default now();

comment on column public.hackathons.starts_at is 'Legacy start timestamp kept in sync with start_date for older linked databases.';
comment on column public.hackathons.ends_at is 'Legacy end timestamp kept in sync with end_date for older linked databases.';
