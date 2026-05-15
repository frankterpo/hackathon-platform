#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseDotenvLines } from "./lib/parse-dotenv-lines.mjs";

loadDotenvFile(".env");
loadDotenvFile(".env.local");

const supabaseUrl =
  envTrim("SUPABASE_URL") ?? envTrim("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = envTrim("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  fail(
    "Missing Supabase env. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fakeThemeSlugs = [
  "berlin-edge-2025",
  "london-reliability-2025",
  "london-2026",
  "nyc-ui-foundations-2026",
  "remote-docs-dx-2024",
  "sf-product-sprint-2026",
];

/** Clear Vercel slugs for rows that pointed at removed or unrelated projects. */
const backfills = [
  {
    match: { luma_url: "https://luma.com/2ohizf10" },
    values: { vercel_project_slug: null },
  },
  {
    match: { luma_url: "https://luma.com/1ufgfhvv" },
    values: { vercel_project_slug: null },
  },
  {
    match: { luma_url: "https://luma.com/b6jccpfu" },
    values: { vercel_project_slug: null },
  },
  {
    match: { theme_slug: "london-2026" },
    values: { vercel_project_slug: null },
  },
  {
    match: { theme_slug: "cursor-thrads-london-2026" },
    values: { vercel_project_slug: null },
  },
];

for (const slug of fakeThemeSlugs) {
  const { data: row, error: lookupError } = await supabase
    .from("hackathons")
    .select("id,name,theme_slug")
    .eq("theme_slug", slug)
    .maybeSingle();

  if (lookupError) {
    fail(`Lookup failed for fake row ${slug}: ${lookupError.message}`);
  }
  if (!row) {
    continue;
  }

  const { count, error: submissionsError } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("hackathon_id", row.id);

  if (submissionsError) {
    fail(`Could not check submissions for ${slug}: ${submissionsError.message}`);
  }
  if ((count ?? 0) > 0) {
    console.log(`kept ${row.name} (${slug}) because it has ${count} submission(s)`);
    continue;
  }

  const { error: deleteError } = await supabase
    .from("hackathons")
    .delete()
    .eq("id", row.id);

  if (deleteError) {
    if (deleteError.code === "23503") {
      console.log(`kept ${row.name} (${slug}) because another table references it`);
      continue;
    }
    fail(`Delete failed for ${slug}: ${deleteError.message}`);
  }
  console.log(`deleted fake seed row: ${row.name} (${slug})`);
}

for (const { match, values } of backfills) {
  let query = supabase.from("hackathons").update(values);
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }
  const { error } = await query;
  if (error) {
    fail(`Backfill failed for ${JSON.stringify(match)}: ${error.message}`);
  }
  console.log(`backfilled ${JSON.stringify(match)} with ${JSON.stringify(values)}`);
}

console.log("hackathon data cleanup complete");

function loadDotenvFile(name) {
  const path = resolve(process.cwd(), name);
  try {
    const content = readFileSync(path, "utf8");
    for (const [key, value] of parseDotenvLines(content)) {
      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function envTrim(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
