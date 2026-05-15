-- Idempotent cleanup of legacy seed hackathon rows that never received a real
-- Luma event API id. These duplicates the product surfaces as ghost cards on
-- /app/master (see isUsableLumaEventId in src/lib/hackathons/master-overview.ts).
--
-- Canonical merged row for Thrads / AdTech London May 2026:
--   99c06fd0-c64a-4555-a38f-497eac67a50f
--
-- Prefer running the full merge first when Thrads data still lives on the source id:
--   supabase/migrations/20260515120000_merge_thrads_into_adtech_delete_legacy_hacks.sql
-- That migration deletes the same primary keys unconditionally after repointing FKs.
-- This migration only removes rows that are still present as empty “shells” (no evt id).
--
-- CASCADE: child tables reference hackathons ON DELETE CASCADE (portal config, tasks, etc.).
-- Reversible: restore from backup or re-insert; no automatic down migration.

delete from public.hackathons
where id in (
  'a0000001-0000-4000-8000-000000000001',
  'a0000002-0000-4000-8000-000000000002',
  'a0000003-0000-4000-8000-000000000003'
)
and (
  luma_event_id is null
  or length(btrim(luma_event_id)) = 0
  or lower(btrim(luma_event_id)) in (
    '-',
    'n/a',
    'na',
    'none',
    'null',
    'pending',
    'tbd',
    'unknown',
    'unset'
  )
  or btrim(luma_event_id) in ('–', '—')
);
