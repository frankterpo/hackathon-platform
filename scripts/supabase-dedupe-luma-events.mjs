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

const canonicalUrl = "https://luma.com/b6jccpfu";
const duplicateUrl = "https://luma.com/wl7a90xe";

const { data: canonical, error: canonicalError } = await supabase
  .from("hackathons")
  .select("id,name,luma_url,luma_event_id")
  .eq("luma_url", canonicalUrl)
  .maybeSingle();

if (canonicalError) {
  fail(`Canonical lookup failed: ${canonicalError.message}`);
}
if (!canonical) {
  fail(`Canonical hackathon is missing: ${canonicalUrl}. Run npm run luma:ingest first.`);
}

const { data: duplicate, error: duplicateError } = await supabase
  .from("hackathons")
  .select("id,name,luma_url,luma_event_id")
  .eq("luma_url", duplicateUrl)
  .maybeSingle();

if (duplicateError) {
  fail(`Duplicate lookup failed: ${duplicateError.message}`);
}
if (!duplicate) {
  console.log(`No duplicate found for ${duplicateUrl}; canonical row remains ${canonical.name}.`);
  process.exit(0);
}

const { count: submissionsCount, error: submissionsError } = await supabase
  .from("submissions")
  .select("id", { count: "exact", head: true })
  .eq("hackathon_id", duplicate.id);

if (submissionsError) {
  fail(`Could not check duplicate submissions: ${submissionsError.message}`);
}
if ((submissionsCount ?? 0) > 0) {
  fail(
    `Refusing to delete duplicate ${duplicate.id}: it has ${submissionsCount} submission(s). Merge manually.`,
  );
}

const { error: deleteError } = await supabase
  .from("hackathons")
  .delete()
  .eq("id", duplicate.id);

if (deleteError) {
  fail(`Duplicate delete failed: ${deleteError.message}`);
}

console.log(
  `Deleted duplicate Luma row ${duplicate.name} (${duplicateUrl}); kept ${canonical.name} (${canonicalUrl}).`,
);

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
