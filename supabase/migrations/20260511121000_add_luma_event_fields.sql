-- Store normalized Luma event metadata for ingestion-driven hackathon rows.

alter table public.hackathons add column if not exists luma_url text;
alter table public.hackathons add column if not exists luma_event_title text;
alter table public.hackathons add column if not exists luma_timezone text;
alter table public.hackathons add column if not exists luma_location text;
alter table public.hackathons add column if not exists luma_description text;
alter table public.hackathons add column if not exists luma_raw_payload jsonb;

create unique index if not exists hackathons_luma_event_id_key
  on public.hackathons (luma_event_id)
  where luma_event_id is not null;

create unique index if not exists hackathons_luma_url_key
  on public.hackathons (luma_url)
  where luma_url is not null;

create unique index if not exists hackathons_theme_slug_key
  on public.hackathons (theme_slug)
  where theme_slug is not null;

comment on column public.hackathons.luma_url is 'Canonical public Luma event URL, e.g. https://luma.com/b6jccpfu.';
comment on column public.hackathons.luma_event_title is 'Luma event title at ingestion time.';
comment on column public.hackathons.luma_timezone is 'IANA timezone from Luma event metadata.';
comment on column public.hackathons.luma_location is 'Human-readable Luma location/address.';
comment on column public.hackathons.luma_description is 'Plain text event description from Luma when available.';
comment on column public.hackathons.luma_raw_payload is 'Sanitized raw public Luma event payload used for debugging ingestion.';
