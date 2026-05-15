-- Merge duplicate hack rows: Thrads seed UUID -> canonical AdTech May-2026 row.
-- Preserves allocations, claims, submissions, judge scores (via submissions), tasks,
-- agent runs, portal config, and judging criteria.
--
-- Deletes legacy seed hacks (HCMC + unused Briefcase row) with ON DELETE CASCADE.
--
-- After apply: point HACK_PAGE_DOMAIN_MAP at keeper id
--   99c06fd0-c64a-4555-a38f-497eac67a50f

-- ---------------------------------------------------------------------------
-- Snapshot source row (Thrads) before we delete it — avoids unique slug/theme
-- collisions while both rows still exist.
-- ---------------------------------------------------------------------------
create temp table _merge_thrads_hack on commit drop as
select *
from public.hackathons
where id = 'a0000003-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Credit claims: detach, repoint allocations, restore (FK-safe order)
-- ---------------------------------------------------------------------------
create temp table _thrads_credit_claims on commit drop as
select *
from public.credit_claims
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

delete from public.credit_claims
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

delete from public.credit_claims c
where c.hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
  and exists (
    select 1
    from _thrads_credit_claims b
    where b.email = c.email
  );

delete from public.credit_allocations ca
where ca.hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
  and exists (
    select 1
    from public.credit_allocations o
    where o.hackathon_id = 'a0000003-0000-4000-8000-000000000003'
      and o.email = ca.email
  );

update public.credit_allocations
set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

insert into public.credit_claims (
  id,
  hackathon_id,
  email,
  claimed_by_user_id,
  delivered_link,
  delivered_code,
  ip,
  user_agent,
  claimed_at
)
select
  id,
  '99c06fd0-c64a-4555-a38f-497eac67a50f'::uuid,
  email,
  claimed_by_user_id,
  delivered_link,
  delivered_code,
  ip,
  user_agent,
  claimed_at
from _thrads_credit_claims;

-- ---------------------------------------------------------------------------
-- Attendees & judges (composite keys)
-- ---------------------------------------------------------------------------
delete from public.hackathon_attendees a_keep
where a_keep.hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
  and exists (
    select 1
    from public.hackathon_attendees o
    where o.hackathon_id = 'a0000003-0000-4000-8000-000000000003'
      and o.email = a_keep.email
  );

update public.hackathon_attendees
set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

delete from public.hackathon_judges j_keep
where j_keep.hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
  and exists (
    select 1
    from public.hackathon_judges o
    where o.hackathon_id = 'a0000003-0000-4000-8000-000000000003'
      and o.email = j_keep.email
  );

update public.hackathon_judges
set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Submissions, tasks, agent runs
-- ---------------------------------------------------------------------------
update public.submissions
set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

update public.hackathon_tasks
set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

update public.agent_runs
set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Optional tables
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'hackathon_portal_config'
  ) then
    if exists (
      select 1
      from public.hackathon_portal_config
      where hackathon_id = 'a0000003-0000-4000-8000-000000000003'
    ) then
      delete from public.hackathon_portal_config
      where hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f';

      update public.hackathon_portal_config
      set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
      where hackathon_id = 'a0000003-0000-4000-8000-000000000003';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'credit_claim_attempts'
  ) then
    update public.credit_claim_attempts
    set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
    where hackathon_id = 'a0000003-0000-4000-8000-000000000003';
  end if;
end $$;

delete from public.hackathon_judging_criteria
where hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
  and exists (
    select 1
    from public.hackathon_judging_criteria o
    where o.hackathon_id = 'a0000003-0000-4000-8000-000000000003'
  );

update public.hackathon_judging_criteria
set hackathon_id = '99c06fd0-c64a-4555-a38f-497eac67a50f'
where hackathon_id = 'a0000003-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Legacy hacks: tables with hackathon_id FK but no ON DELETE CASCADE
-- ---------------------------------------------------------------------------
delete from public.analysis_settings
where hackathon_id in (
  'a0000001-0000-4000-8000-000000000001',
  'a0000002-0000-4000-8000-000000000002'
);

delete from public.submissions
where hackathon_id in (
  'a0000001-0000-4000-8000-000000000001',
  'a0000002-0000-4000-8000-000000000002'
);

delete from public.judge_responses
where hackathon_id in (
  'a0000001-0000-4000-8000-000000000001',
  'a0000002-0000-4000-8000-000000000002'
);

delete from public.analyses
where hackathon_id in (
  'a0000001-0000-4000-8000-000000000001',
  'a0000002-0000-4000-8000-000000000002'
);

-- ---------------------------------------------------------------------------
-- Remove source + legacy hacks (no slug collision: source row gone first)
-- ---------------------------------------------------------------------------
delete from public.hackathons
where id = 'a0000003-0000-4000-8000-000000000003';

delete from public.hackathons
where id in (
  'a0000001-0000-4000-8000-000000000001',
  'a0000002-0000-4000-8000-000000000002'
);

-- ---------------------------------------------------------------------------
-- Apply Thrads metadata onto keeper; keep May-2026 schedule on AdTech row
-- ---------------------------------------------------------------------------
update public.hackathons as d
set
  name = coalesce(nullif(trim(m.name), ''), d.name),
  slug = coalesce(nullif(trim(m.slug), ''), d.slug),
  theme_slug = coalesce(nullif(trim(m.theme_slug), ''), d.theme_slug),
  firebase_config_ref = coalesce(
    nullif(trim(m.firebase_config_ref), ''),
    d.firebase_config_ref
  ),
  vercel_project_slug = coalesce(m.vercel_project_slug, d.vercel_project_slug),
  luma_event_id = coalesce(nullif(trim(m.luma_event_id), ''), d.luma_event_id),
  luma_url = coalesce(nullif(trim(m.luma_url), ''), d.luma_url),
  luma_event_title = coalesce(nullif(trim(m.luma_event_title), ''), d.luma_event_title),
  luma_timezone = coalesce(nullif(trim(m.luma_timezone), ''), d.luma_timezone),
  luma_location = coalesce(nullif(trim(m.luma_location), ''), d.luma_location),
  luma_description = coalesce(nullif(trim(m.luma_description), ''), d.luma_description),
  luma_raw_payload = coalesce(m.luma_raw_payload, d.luma_raw_payload),
  status = case
    when m.status = 'live' then 'live'
    else d.status
  end
from _merge_thrads_hack m
where d.id = '99c06fd0-c64a-4555-a38f-497eac67a50f';
