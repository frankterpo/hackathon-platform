import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = join(
  root,
  "supabase/migrations/20260514140000_hackathon_tasks_and_agent_runs.sql",
);

test("hackathon_tasks migration defines checklist table", () => {
  const sql = readFileSync(migration, "utf8");
  assert.match(sql, /create table if not exists public\.hackathon_tasks/i);
  assert.match(sql, /hackathon_tasks_hackathon_sort_idx/i);
});

test("integration lookup migration creates luma_events + firebase_projects", () => {
  const sql = readFileSync(
    join(root, "supabase/migrations/20260516183000_integration_lookup_tables.sql"),
    "utf8",
  );
  assert.match(sql, /create table if not exists public\.luma_events/i);
  assert.match(sql, /create table if not exists public\.firebase_projects/i);
  assert.match(sql, /hackathons_luma_event_uuid_fkey/i);
  assert.match(sql, /on delete restrict/i);
});

test("judges uuid migration defines canonical judges table + triggers", () => {
  const sql = readFileSync(
    join(root, "supabase/migrations/20260519120000_judges_uuid_identity.sql"),
    "utf8",
  );
  assert.match(sql, /create table if not exists public\.judges/i);
  assert.match(sql, /judge_scores_set_judge_id/i);
  assert.match(sql, /hackathon_judges_set_judge_id/i);
  assert.match(sql, /ensure_judge_id_for_email/i);
});

test("submissions pipeline columns migration adds structured export fields", () => {
  const sql = readFileSync(
    join(
      root,
      "supabase/migrations/20260517140000_submissions_pipeline_export_columns.sql",
    ),
    "utf8",
  );
  assert.match(sql, /demo_url/i);
  assert.match(sql, /project_description/i);
  assert.match(sql, /total_commits/i);
});
