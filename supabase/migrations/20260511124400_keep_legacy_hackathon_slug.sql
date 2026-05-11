-- Keep legacy public.hackathons.slug compatible with the newer theme_slug field.
-- Some linked projects still have slug as a NOT NULL column, so do not drop it.

alter table public.hackathons add column if not exists slug text;

create or replace function public.normalize_hackathon_slug(value text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '-', 'g')),
        '-+',
        '-',
        'g'
      ),
      '-'
    ),
    ''
  );
$$;

update public.hackathons
set
  theme_slug = coalesce(
    nullif(trim(theme_slug), ''),
    nullif(trim(slug), ''),
    public.normalize_hackathon_slug(name) || '-' || left(replace(id::text, '-', ''), 8)
  ),
  slug = coalesce(
    nullif(trim(slug), ''),
    nullif(trim(theme_slug), ''),
    public.normalize_hackathon_slug(name) || '-' || left(replace(id::text, '-', ''), 8)
  )
where theme_slug is null
  or nullif(trim(theme_slug), '') is null
  or slug is null
  or nullif(trim(slug), '') is null;

create or replace function public.set_hackathon_slugs()
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

  return new;
end;
$$;

drop trigger if exists hackathons_set_slugs on public.hackathons;
create trigger hackathons_set_slugs
  before insert or update on public.hackathons
  for each row execute function public.set_hackathon_slugs();

alter table public.hackathons alter column slug set not null;

do $$
begin
  if exists (
    select 1
    from public.hackathons
    group by slug
    having count(*) > 1
  ) then
    raise notice 'public.hackathons has duplicate slug values; skipping hackathons_slug_key until rows are deduplicated.';
  else
    create unique index if not exists hackathons_slug_key
      on public.hackathons (slug);
  end if;
end $$;

comment on column public.hackathons.slug is 'Legacy stable slug kept in sync with theme_slug for older linked databases.';
