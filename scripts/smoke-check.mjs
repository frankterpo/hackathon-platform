#!/usr/bin/env node
/**
 * Lightweight repo sanity check (no Supabase required). Run via npm test / npm run check.
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requiredPaths = [
  "package.json",
  ".env.example",
  "src/app/page.tsx",
  "src/app/admin/master-panel/page.tsx",
  "supabase/migrations/20250510120000_initial_schema.sql",
  "supabase/seed.sql",
];

let failed = false;
for (const rel of requiredPaths) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error(`smoke-check: missing required path ${rel}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("smoke-check: ok");
