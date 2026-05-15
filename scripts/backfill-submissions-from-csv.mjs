#!/usr/bin/env node
/**
 * Backfill structured pipeline columns on existing submissions from a CSV export.
 *
 *   node scripts/backfill-submissions-from-csv.mjs \
 *     --hackathon-id 300dfc81-abc4-411e-b5f0-5a9c9b78b78f \
 *     --submissions "/Users/pablote/Downloads/submissions_rows.csv"
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseDotenvLines } from "./lib/parse-dotenv-lines.mjs";
import {
  normalizeRepoUrl,
  structuredFieldsFromCsvRow,
} from "./lib/submission-csv-fields.mjs";

function loadDotenvFile(name) {
  try {
    const p = resolve(process.cwd(), name);
    const text = readFileSync(p, "utf8");
    for (const [k, v] of parseDotenvLines(text)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

function envTrim(key) {
  const v = process.env[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

loadDotenvFile(".env");
loadDotenvFile(".env.local");

const supabaseUrl =
  envTrim("SUPABASE_URL") ?? envTrim("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = envTrim("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function csvToRecords(csvPath) {
  const py = `
import csv, json, sys
with open(sys.argv[1], newline="", encoding="utf-8") as f:
    print(json.dumps(list(csv.DictReader(f))))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", py, csvPath], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    }),
  );
}

function parseArgs(argv) {
  const o = { submissions: [], dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--hackathon-id") o.hackathonId = argv[++i];
    else if (a === "--submissions") o.submissions.push(argv[++i]);
    else if (a === "--dry-run") o.dryRun = true;
  }
  return o;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.hackathonId || !args.submissions.length) {
    console.error("Need --hackathon-id and --submissions path(s).");
    process.exit(1);
  }

  const { data: subs, error: sErr } = await supabase
    .from("submissions")
    .select("id,repo_url")
    .eq("hackathon_id", args.hackathonId);
  if (sErr) throw new Error(sErr.message);

  /** @type {Map<string, string>} */
  const idByNormUrl = new Map();
  for (const s of subs ?? []) {
    const k = normalizeRepoUrl(s.repo_url ?? "");
    if (k) idByNormUrl.set(k, s.id);
  }

  /** @type {Map<string, Record<string,string>>} */
  const byRepo = new Map();
  for (const p of args.submissions) {
    for (const row of csvToRecords(p)) {
      const k = normalizeRepoUrl(row.repo_url ?? "");
      if (k && !byRepo.has(k)) byRepo.set(k, row);
    }
  }

  let updated = 0;
  let missing = 0;

  for (const [urlKey, row] of byRepo) {
    const id = idByNormUrl.get(urlKey);
    if (!id) {
      missing++;
      console.error(`No submission for CSV repo_url ${row.repo_url}`);
      continue;
    }
    const patch = structuredFieldsFromCsvRow(row);
    if (args.dryRun) {
      updated++;
      continue;
    }
    const { error: uErr } = await supabase
      .from("submissions")
      .update(patch)
      .eq("id", id);
    if (uErr) {
      console.error(`Update failed ${id}: ${uErr.message}`);
      continue;
    }
    updated++;
  }

  console.error(
    args.dryRun
      ? `[dry-run] Would update ${updated} rows; unmatched CSV rows: ${missing}`
      : `Updated ${updated} submissions; unmatched CSV rows: ${missing}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
