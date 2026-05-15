#!/usr/bin/env node
// Usage: node scripts/backfill-submissions-from-body.mjs [--hackathon-id UUID] [--dry-run] (Node >=20)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseDotenvLines } from "./lib/parse-dotenv-lines.mjs";
import { parseStructuredSubmissionBody } from "./lib/submission-csv-fields.mjs";

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

/** @param {unknown} v */
function colEmpty(v) {
  return v == null || String(v).trim() === "";
}

/**
 * @param {{ chosen_track: unknown; demo_url: unknown; team_members: unknown; participant_notes: unknown; description: unknown }} row
 * @param {string} body
 */
function buildPatch(row, body) {
  const parsed = parseStructuredSubmissionBody(body);
  /** @type {Record<string, string>} */
  const patch = {};

  if (colEmpty(row.chosen_track) && parsed.chosen_track) {
    patch.chosen_track = parsed.chosen_track;
  }
  if (colEmpty(row.demo_url) && parsed.demo_url) {
    patch.demo_url = parsed.demo_url;
  }
  if (colEmpty(row.team_members) && parsed.team_members) {
    patch.team_members = parsed.team_members;
  }

  if (colEmpty(row.description) && parsed.description) {
    patch.description = parsed.description;
  }

  if (colEmpty(row.participant_notes) && parsed.participant_notes) {
    patch.participant_notes = parsed.participant_notes;
  }

  if (
    colEmpty(row.description) &&
    !parsed.description &&
    !parsed._meta.hadAnyLabeledBlock
  ) {
    const t = body.trim();
    if (t) patch.description = t;
  }

  return patch;
}

function parseArgs(argv) {
  const o = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--hackathon-id") o.hackathonId = argv[++i];
    else if (a === "--dry-run") o.dryRun = true;
  }
  return o;
}

async function main() {
  const args = parseArgs(process.argv);
  const pageSize = 500;
  let from = 0;
  let examined = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let failed = 0;

  for (;;) {
    let q = supabase
      .from("submissions")
      .select(
        "id,hackathon_id,body,chosen_track,demo_url,team_members,participant_notes,description",
      )
      .not("body", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.hackathonId) {
      q = q.eq("hackathon_id", args.hackathonId.trim());
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows?.length) break;

    for (const row of rows) {
      examined++;
      const body = (row.body ?? "").toString();
      if (!body.trim()) continue;

      const needs =
        colEmpty(row.chosen_track) ||
        colEmpty(row.demo_url) ||
        colEmpty(row.team_members) ||
        colEmpty(row.participant_notes) ||
        colEmpty(row.description);
      if (!needs) continue;

      const patch = buildPatch(row, body);
      if (Object.keys(patch).length === 0) continue;

      wouldUpdate++;
      if (args.dryRun) {
        console.error(`[dry-run] ${row.id} patch=${JSON.stringify(patch)}`);
        continue;
      }

      const { error: uErr } = await supabase
        .from("submissions")
        .update(patch)
        .eq("id", row.id);

      if (uErr) {
        failed++;
        console.error(`Update failed ${row.id}: ${uErr.message}`);
      } else {
        updated++;
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.error(
    `Examined ${examined} rows with non-null body; ${wouldUpdate} ${args.dryRun ? "would update" : "matched for update"} (${args.dryRun ? 0 : updated} updated, ${failed} failed).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
