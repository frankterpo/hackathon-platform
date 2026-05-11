-- Loaded from supabase/config.toml [db.seed] on `supabase db reset` (local) or
-- `supabase db push --linked --include-seed` (see `npm run supabase:apply`).
--
-- Intentionally empty: do not seed fake/demo hackathons into the master panel.
-- Real rows come from Luma via:
--
--   npm run luma:ingest
--
-- Keep this file as a no-op so Supabase CLI seed workflows remain safe.
select 'seed skipped: run npm run luma:ingest for real hackathon rows' as message;
