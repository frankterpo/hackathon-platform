-- First-class columns for pipeline / CSV exports (demo, analysis, git stats).
-- Keeps legacy `body` free-form; imports populate both structured fields and body.

alter table public.submissions add column if not exists demo_url text;
alter table public.submissions add column if not exists chosen_track text;
alter table public.submissions add column if not exists team_members text;
alter table public.submissions add column if not exists participant_notes text;
alter table public.submissions add column if not exists export_repo_id text;

alter table public.submissions add column if not exists analysis_status text;
alter table public.submissions add column if not exists analyzed_at timestamptz;
alter table public.submissions add column if not exists analysis_error text;

alter table public.submissions add column if not exists ai_text text;
alter table public.submissions add column if not exists ai_model text;
alter table public.submissions add column if not exists ai_generated_at timestamptz;
alter table public.submissions add column if not exists ai_error text;

alter table public.submissions add column if not exists total_commits integer;
alter table public.submissions add column if not exists total_commits_before_t0 integer;
alter table public.submissions add column if not exists total_commits_during_event integer;
alter table public.submissions add column if not exists total_commits_after_t1 integer;
alter table public.submissions add column if not exists total_loc_added integer;
alter table public.submissions add column if not exists total_loc_deleted integer;

alter table public.submissions add column if not exists has_commits_before_t0 integer;
alter table public.submissions add column if not exists has_bulk_commits integer;
alter table public.submissions add column if not exists has_large_initial_commit_after_t0 integer;
alter table public.submissions add column if not exists has_merge_commits integer;

alter table public.submissions add column if not exists default_branch text;
alter table public.submissions add column if not exists project_description text;
alter table public.submissions add column if not exists uses_white_circle boolean;

comment on column public.submissions.demo_url is 'Primary demo / video URL from ingest or CSV.';
comment on column public.submissions.chosen_track is 'Hackathon track label from participant or pipeline.';
comment on column public.submissions.team_members is 'Free-form roster string from exports.';
comment on column public.submissions.participant_notes is 'Participant notes field from CSV ingest.';
comment on column public.submissions.export_repo_id is 'Upstream pipeline repo slug/id (not submissions.id).';
comment on column public.submissions.project_description is 'Project description text from pipeline export.';
