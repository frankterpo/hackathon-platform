#!/usr/bin/env node
/**
 * Recover submissions + leaderboard judge_scores from CSV exports into Supabase.
 *
 * Prerequisites: `.env.local` with NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) +
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Example:
 *   node scripts/import-hackathon-csv-recovery.mjs \
 *     --hackathon-id 300dfc81-abc4-411e-b5f0-5a9c9b78b78f \
 *     --submissions "/Users/pablote/Downloads/submissions_rows.csv" \
 *     --submissions "/Users/pablote/Downloads/submissions_rows (1).csv" \
 *     --leaderboard "/Users/pablote/Downloads/london-q3-2026-leaderboard.csv"
 *
 * Flags:
 *   --dry-run        Parse + counts only (no writes).
 *   --score-mult N   Multiply judge scores from leaderboard (default 10 → 7 becomes 70).
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseDotenvLines } from "./lib/parse-dotenv-lines.mjs";
import {
  deriveRepoKeyFromUrl,
  normalizeRepoUrl as normalizeRepoUrlCsv,
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
  console.error(
    "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** @param {string} csvPath */
function csvToRecords(csvPath) {
  const py = `
import csv, json, sys
path = sys.argv[1]
with open(path, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(json.dumps(rows))
`;
  const out = execFileSync("python3", ["-c", py, csvPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  return JSON.parse(out);
}

function normalizeRepoUrl(url) {
  return normalizeRepoUrlCsv(url);
}

function slugJudge(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);
}

/**
 * @param {string} breakdown e.g. "Umberto Belluzzo: 7 | David Gelberg: 7"
 */
function parsePanelBreakdown(breakdown, scoreMult) {
  const parts = String(breakdown || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = /^([^:0-9]+)\s*:\s*([\d.]+)\s*$/.exec(p);
    if (!m) continue;
    const name = m[1].trim();
    const raw = Number(m[2]);
    if (!Number.isFinite(raw)) continue;
    const score = Math.min(100, Math.max(0, raw * scoreMult));
    out.push({ name, score });
  }
  return out;
}

function parseArgs(argv) {
  /** @type {{ hackathonId?: string, submissions: string[], leaderboard?: string, dryRun: boolean, scoreMult: number }} */
  const o = {
    submissions: [],
    dryRun: false,
    scoreMult: 10,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--hackathon-id") o.hackathonId = argv[++i];
    else if (a === "--submissions") o.submissions.push(argv[++i]);
    else if (a === "--leaderboard") o.leaderboard = argv[++i];
    else if (a === "--score-mult") o.scoreMult = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`
Usage:
  node scripts/import-hackathon-csv-recovery.mjs \\
    --hackathon-id <uuid> \\
    --submissions path/to/submissions_rows.csv \\
    [--submissions path2.csv ...] \\
    [--leaderboard path/to/leaderboard.csv] \\
    [--score-mult 10] [--dry-run]
`);
      process.exit(0);
    }
  }
  return o;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.hackathonId) {
    console.error("Required: --hackathon-id <uuid>");
    process.exit(1);
  }
  if (!args.submissions.length) {
    console.error("Required: at least one --submissions path");
    process.exit(1);
  }

  const { data: hack, error: hErr } = await supabase
    .from("hackathons")
    .select("id,name")
    .eq("id", args.hackathonId)
    .maybeSingle();
  if (hErr)
    throw new Error(`hackathon lookup: ${hErr.message}`);
  if (!hack)
    throw new Error(`No hackathon row for id ${args.hackathonId}`);

  console.error(`Target hackathon: ${hack.name} (${hack.id})`);

  /** @type {Map<string, Record<string,string>>} */
  const byRepo = new Map();
  for (const p of args.submissions) {
    console.error(`Reading submissions CSV: ${p}`);
    const rows = csvToRecords(p);
    for (const row of rows) {
      const key = normalizeRepoUrl(row.repo_url);
      if (!key) continue;
      if (!byRepo.has(key)) byRepo.set(key, row);
    }
  }
  console.error(`Unique submissions by repo_url: ${byRepo.size}`);

  /** @type {Map<string, string>} repo URL -> submission uuid */
  const repoToSubmissionId = new Map();

  if (!args.dryRun) {
    let inserted = 0;
    let skipped = 0;
    for (const [urlKey, row] of byRepo) {
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("hackathon_id", args.hackathonId)
        .eq("repo_url", row.repo_url?.trim())
        .maybeSingle();

      if (existing?.id) {
        repoToSubmissionId.set(urlKey, existing.id);
        skipped++;
        continue;
      }

      const title = (row.project_name || "Untitled").trim() || "Untitled";
      const team = row.team_name?.trim() || null;
      const rk =
        (row.repo_key || row.repo_id || deriveRepoKeyFromUrl(row.repo_url) || "")
          .trim() || normalizeRepoUrl(row.repo_url).replace(/^https:\/\//, "");
      const structured = structuredFieldsFromCsvRow(row);
      const bodyParts = [
        row.chosen_track && `Track: ${row.chosen_track}`,
        row.demo_url && `Demo: ${row.demo_url}`,
        row.team_members && `Team: ${row.team_members}`,
        row.description && `Description:\n${row.description}`,
        row.ai_text && `AI notes:\n${row.ai_text}`,
      ].filter(Boolean);
      const body = bodyParts.join("\n\n") || null;

      const ins = {
        hackathon_id: args.hackathonId,
        repo_key: rk,
        title,
        body,
        team_name: team,
        repo_url: row.repo_url?.trim() || null,
        created_at: row.submitted_at || new Date().toISOString(),
        updated_at: row.submitted_at || new Date().toISOString(),
        ...structured,
      };

      const { data: insRow, error: insErr } = await supabase
        .from("submissions")
        .insert(ins)
        .select("id")
        .single();

      if (insErr) {
        console.error(`Insert failed (${urlKey}): ${insErr.message}`);
        continue;
      }
      repoToSubmissionId.set(urlKey, insRow.id);
      inserted++;
    }
    console.error(`Submissions inserted: ${inserted}, already present: ${skipped}`);
  } else {
    console.error("[dry-run] Skipping submission inserts.");
  }

  if (args.leaderboard) {
    console.error(`Reading leaderboard CSV: ${args.leaderboard}`);
    const lb = csvToRecords(args.leaderboard);
    let scoreRows = 0;
    let miss = 0;

    if (!args.dryRun) {
      for (const row of lb) {
        const key = normalizeRepoUrl(row.repo_url);
        if (!key) {
          miss++;
          continue;
        }
        let submissionId = repoToSubmissionId.get(key);
        if (!submissionId) {
          const { data: found } = await supabase
            .from("submissions")
            .select("id")
            .eq("hackathon_id", args.hackathonId)
            .eq("repo_url", row.repo_url?.trim())
            .maybeSingle();
          submissionId = found?.id;
        }
        if (!submissionId) {
          console.error(
            `No submission for leaderboard row repo ${row.repo_url} (${row.project_name})`,
          );
          miss++;
          continue;
        }

        const judges = parsePanelBreakdown(
          row.panel_breakdown,
          args.scoreMult,
        );
        const { error: wipeErr } = await supabase
          .from("judge_scores")
          .delete()
          .eq("submission_id", submissionId)
          .like("judge_email", "%@leaderboard@import.local");
        if (wipeErr)
          console.error(`clear import judge_scores: ${wipeErr.message}`);

        for (const j of judges) {
          const email = `${slugJudge(j.name) || "unknown"}.leaderboard@import.local`;
          const { error: scErr } = await supabase.from("judge_scores").insert({
            submission_id: submissionId,
            judge_email: email,
            score: j.score,
            notes: `Imported from leaderboard; judge: ${j.name}`,
            judge_user_id: null,
          });
          if (scErr) {
            console.error(`judge_scores insert: ${scErr.message}`);
            continue;
          }
          scoreRows++;
        }
      }
    } else {
      for (const row of lb) {
        const judges = parsePanelBreakdown(
          row.panel_breakdown,
          args.scoreMult,
        );
        scoreRows += judges.length;
      }
      console.error(`[dry-run] Would attempt ~${scoreRows} judge_score cells.`);
    }

    if (!args.dryRun)
      console.error(`Judge score rows written: ${scoreRows}; unmatched LB rows: ${miss}`);
  }

  console.error("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
