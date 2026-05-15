import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = join(
  root,
  "supabase/migrations/20260515140000_delete_legacy_hack_shells_without_luma.sql",
);

test("legacy shell migration targets known seed UUIDs and luma guards", () => {
  const sql = readFileSync(migration, "utf8");
  assert.match(sql, /a0000003-0000-4000-8000-000000000003/);
  assert.match(sql, /a0000002-0000-4000-8000-000000000002/);
  assert.match(sql, /99c06fd0-c64a-4555-a38f-497eac67a50f/);
  assert.match(sql, /btrim\(luma_event_id\)/i);
});
