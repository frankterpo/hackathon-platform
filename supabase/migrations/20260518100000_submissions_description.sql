-- Participant-facing description (portal / structured body "Description:" block).
alter table public.submissions add column if not exists description text;

comment on column public.submissions.description is 'Participant project description from ingest, CSV, or structured submission body.';
