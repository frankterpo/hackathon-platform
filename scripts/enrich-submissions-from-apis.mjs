#!/usr/bin/env node
/**
 * Enrich `public.submissions` from GitHub REST + OpenAI-compatible OpenCode gateway.
 *
 * Column → source matrix (fills only when NULL or blank string; never overwrites non-empty):
 * | column                      | immutable? | source |
 * |-----------------------------|------------|--------|
 * | id                          | yes        | — |
 * | hackathon_id                | yes        | — |
 * | repo_key                    | yes        | — |
 * | created_at, updated_at      | yes*       | — (*updated_at via DB trigger on write) |
 * | submitter_user_id           | yes        | — |
 * | submitter_email             | yes        | — |
 * | title, team_name, body      | yes        | participant text; not machine-filled |
 * | export_repo_id              | skip       | upstream pipeline id |
 * | repo_url                    | yes        | — |
 * | description                 | enrich     | OpenCode JSON (README / GH context / portal text) |
 * | participant_notes           | enrich     | OpenCode JSON |
 * | chosen_track                | enrich     | OpenCode JSON |
 * | demo_url                    | enrich     | OpenCode JSON (only if explicitly in README text) |
 * | project_description         | enrich     | GitHub repo `description` |
 * | default_branch              | enrich     | GitHub repo `default_branch` |
 * | total_commits               | enrich     | GitHub commits list `Link: rel=last` trick |
 * | total_loc_added/deleted     | enrich     | GitHub `stats/code_frequency` lifetime sums |
 * | total_commits_* windows     | skip       | needs hackathon t0/t1 — not inferred here |
 * | has_* pipeline flags        | skip       | needs heuristics + hackathon t0/t1 |
 * | uses_white_circle           | skip       | no GitHub signal |
 * | team_members                | skip       | roster not inferred here |
 * | analysis_status             | enrich     | `analyzed` after successful OpenCode; `apis_enriched` for GitHub-only fills |
 * | analyzed_at                 | enrich     | timestamp when row patched |
 * | analysis_error              | enrich     | failures this run; cleared when OpenCode succeeds |
 * | ai_text                     | enrich     | raw OpenCode JSON string on success |
 * | ai_model                    | enrich     | model id used |
 * | ai_generated_at             | enrich     | OpenCode success time |
 * | ai_error                    | enrich     | OpenCode failure message; cleared on success |
 *
 * Env (never printed):
 * - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GITHUB_API_KEY (Bearer) or GITHUB_TOKEN (common alias) — optional with `--skip-github`
 * - OPENCODE_API_KEY (aliases: OPEN_CODE_API_KEY, OPENAI_API_KEY) — if set, OPEN_CODE_BASE_URL is required unless only OPENAI_API_KEY is set (then defaults to https://api.openai.com/v1)
 * - OPEN_CODE_BASE_URL — OpenAI-compatible root, e.g. https://example/v1 (POST /chat/completions)
 * - OPEN_CODE_MODEL — optional; default gpt-4o-mini
 *
 * **Node:** use Node 20+ (project `engines`; `@supabase/supabase-js` + `ws` realtime transport).
 *
 * GitHub-only (no OpenCode): unset OPENCODE_API_KEY, or pass `--skip-opencode`.
 * If OPENCODE_API_KEY is set but OPEN_CODE_BASE_URL is missing, the script exits unless `--skip-opencode`.
 *
 * Flags:
 * - `--skip-github` — do not call GitHub; OpenCode uses submission fields (title, body, repo_url, etc.).
 *   Requires LLM env unless `--skip-opencode` (unusual).
 * - `--github-soft-fail` — log GitHub errors but do not record them in `analysis_error` while OpenCode is enabled
 *   (avoids sticky GitHub 403/409 noise when the model run succeeds).
 * - `--retry-analysis` — for filtered rows (e.g. `--analysis-status apis_enriched`), tighten OpenCode re-run; requires LLM env.
 *   Combines with `--analysis-status apis_enriched` to clear stuck rows.
 * - `--sleep-ms N` — pause N ms after each row (rate limiting / gentle bursts).
 *
 * Examples:
 *   node scripts/enrich-submissions-from-apis.mjs --limit 50 --dry-run
 *   node scripts/enrich-submissions-from-apis.mjs --hackathon-id <uuid> --limit 20
 *   node scripts/enrich-submissions-from-apis.mjs --analysis-status analysis_failed --limit 100
 *
 * Retry stuck `apis_enriched` rows without GitHub (after setting OPEN_CODE_BASE_URL + OPENCODE_API_KEY):
 *   npm run submissions:enrich -- --analysis-status apis_enriched --skip-github --limit 100 --sleep-ms 250
 *
 * Strongly prefer --dry-run first: prints planned patches; skips Supabase updates.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

import {
  fetchCodeFrequencyTotals,
  fetchDefaultBranchCommitCount,
  fetchReadmeUtf8,
  fetchRepoCore,
} from "./lib/github-repo-meta.mjs";
import { openCodeChatJsonPrompt } from "./lib/opencode-chat.mjs";
import { parseDotenvLines } from "./lib/parse-dotenv-lines.mjs";
import { deriveRepoKeyFromUrl } from "./lib/submission-csv-fields.mjs";

function loadDotenvFile(name) {
  try {
    const p = resolve(process.cwd(), name);
    const text = readFileSync(p, "utf8");
    for (const [k, v] of parseDotenvLines(text)) {
      const cur = process.env[k];
      if (
        cur === undefined ||
        (typeof cur === "string" && cur.trim() === "")
      ) {
        process.env[k] = v;
      }
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
const githubToken = envTrim("GITHUB_API_KEY") ?? envTrim("GITHUB_TOKEN");
const openCodeKeyOpenai = envTrim("OPENCODE_API_KEY");
const openCodeKeyAlias = envTrim("OPEN_CODE_API_KEY");
const openAiKeyEnv = envTrim("OPENAI_API_KEY");
const opencodeKey =
  openCodeKeyOpenai ?? openCodeKeyAlias ?? openAiKeyEnv;
const openCodeBase =
  envTrim("OPEN_CODE_BASE_URL") ??
  envTrim("OPEN_CODE_API_URL") ??
  (!openCodeKeyOpenai && !openCodeKeyAlias && openAiKeyEnv
    ? "https://api.openai.com/v1"
    : undefined);
const openCodeModel = envTrim("OPEN_CODE_MODEL") ?? "gpt-4o-mini";

const argvHasSkipOpencode = process.argv.includes("--skip-opencode");

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

if (opencodeKey && !openCodeBase && !argvHasSkipOpencode) {
  console.error(
    [
      "OpenCode API key is set (OPENCODE_API_KEY / OPEN_CODE_API_KEY / OPENAI_API_KEY) but OPEN_CODE_BASE_URL is missing.",
      "Add OPEN_CODE_BASE_URL (OpenAI-compatible root, no trailing slash), or use only OPENAI_API_KEY (defaults to https://api.openai.com/v1).",
      "or unset those keys, or pass --skip-opencode for GitHub-only enrichment.",
      "There is no default base URL (vendor-specific); see header comment for the column matrix.",
    ].join(" "),
  );
  process.exit(1);
}

if (!githubToken && !process.argv.includes("--skip-github")) {
  console.error(
    "[warn] No GITHUB_API_KEY or GITHUB_TOKEN: GitHub enrichment disabled (OpenCode-only where configured).",
  );
}

/**
 * @param {unknown} v
 */
function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} repoUrl
 * @returns {{ owner: string, repo: string } | null}
 */
function parseGithubOwnerRepo(repoUrl) {
  const s = String(repoUrl || "").trim();
  const lower = s.toLowerCase();
  if (!lower.includes("github.com")) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "github.com") return null;
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    let repo = parts[1];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    const key = deriveRepoKeyFromUrl(s);
    if (!key) return null;
    const [owner, repo] = key.split("/", 2);
    return owner && repo ? { owner, repo } : null;
  }
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{
   *   hackathonId?: string,
   *   limit?: number,
   *   dryRun?: boolean,
   *   analysisStatus?: string,
   *   skipOpencode?: boolean,
   *   skipGithub?: boolean,
   *   githubSoftFail?: boolean,
   *   retryAnalysis?: boolean,
   *   sleepMs?: number,
   * }} */
  const o = {
    dryRun: false,
    skipOpencode: false,
    skipGithub: false,
    githubSoftFail: false,
    retryAnalysis: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--hackathon-id") o.hackathonId = argv[++i];
    else if (a === "--limit") o.limit = Number.parseInt(argv[++i], 10);
    else if (a === "--analysis-status") o.analysisStatus = argv[++i];
    else if (a === "--sleep-ms")
      o.sleepMs = Number.parseInt(argv[++i], 10);
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--skip-opencode") o.skipOpencode = true;
    else if (a === "--skip-github") o.skipGithub = true;
    else if (a === "--github-soft-fail") o.githubSoftFail = true;
    else if (a === "--retry-analysis") o.retryAnalysis = true;
  }
  if (o.limit != null && (!Number.isFinite(o.limit) || o.limit < 1)) {
    console.error("--limit must be a positive integer.");
    process.exit(1);
  }
  if (
    o.sleepMs != null &&
    (!Number.isFinite(o.sleepMs) || /** @type {number} */ (o.sleepMs) < 0)
  ) {
    console.error("--sleep-ms must be a non-negative integer.");
    process.exit(1);
  }
  if (o.analysisStatus != null && o.analysisStatus.trim() === "") {
    console.error("--analysis-status requires a non-empty value.");
    process.exit(1);
  }
  return o;
}

const SELECT_COLS = [
  "id",
  "hackathon_id",
  "repo_url",
  "title",
  "team_name",
  "body",
  "created_at",
  "description",
  "demo_url",
  "chosen_track",
  "participant_notes",
  "project_description",
  "default_branch",
  "total_commits",
  "total_loc_added",
  "total_loc_deleted",
  "analysis_status",
  "analyzed_at",
  "analysis_error",
  "ai_text",
  "ai_model",
  "ai_generated_at",
  "ai_error",
].join(",");

const POSITIVE_PATCH_KEYS = new Set([
  "description",
  "demo_url",
  "chosen_track",
  "participant_notes",
  "project_description",
  "default_branch",
  "total_commits",
  "total_loc_added",
  "total_loc_deleted",
  "ai_text",
  "ai_model",
  "ai_generated_at",
]);

const SYSTEM_PROMPT = `You extract hackathon submission metadata from README text, GitHub API hints, and participant/portal submission fields.
Reply with a single JSON object ONLY (no markdown) using these keys:
{"description":string|null,"participant_notes":string|null,"chosen_track":string|null,"demo_url":string|null}
Rules:
- Strings must be concise (description ≤ 800 chars, notes ≤ 600).
- Use null when unknown or not present in the provided context.
- demo_url: only http(s) URLs explicitly written in the context; never invent.
- chosen_track: only if a track/category is stated; else null.
- participant_notes: bullet summary of tech stack / features if evident; else null.
- When README is missing, infer carefully from body/description columns only — do not fabricate URLs.`;

/**
 * @param {Record<string, unknown>} row
 * @param {string} owner
 * @param {string} repo
 * @param {string} ghDescription
 * @param {string} defaultBranch
 * @param {string | null} readme
 */
function buildUserPrompt(row, owner, repo, ghDescription, defaultBranch, readme) {
  const excerpt =
    readme && readme.length > 12_000 ? `${readme.slice(0, 12_000)}\n…` : readme ?? "";
  const hasReadme = excerpt.trim().length > 0;
  const bodyExcerpt =
    typeof row.body === "string" && row.body.length > 12_000
      ? `${row.body.slice(0, 12_000)}\n…`
      : row.body ?? "";
  return [
    `Repository: ${owner}/${repo}`,
    `Existing title (do not repeat verbatim as description): ${row.title ?? ""}`,
    `GitHub API description: ${ghDescription || "(none — API unavailable or skipped)"}`,
    `Default branch: ${defaultBranch || "(unknown)"}`,
    "",
    "README excerpt:",
    hasReadme ? excerpt : "(no README retrieved — use participant / portal context below)",
    "",
    "Participant / portal context:",
    `Team name: ${row.team_name ?? ""}`,
    `Repo URL: ${row.repo_url ?? ""}`,
    `Body / free-form submission:\n${bodyExcerpt || "(empty)"}`,
    `Existing description column: ${row.description ?? ""}`,
    `Existing project_description column: ${row.project_description ?? ""}`,
    `Participant notes column: ${row.participant_notes ?? ""}`,
    `Chosen track column: ${row.chosen_track ?? ""}`,
  ].join("\n");
}

/**
 * @param {string} text
 */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const useOpenCode =
    !args.skipOpencode && !!opencodeKey && !!openCodeBase;

  if (args.retryAnalysis && !useOpenCode) {
    console.error(
      [
        "--retry-analysis requires OpenCode: set OPENCODE_API_KEY or OPEN_CODE_API_KEY or OPENAI_API_KEY, and OPEN_CODE_BASE_URL (or only OPENAI_API_KEY for api.openai.com/v1)",
        "(OpenAI-compatible root, e.g. https://host/v1). Or drop --retry-analysis for GitHub-only work.",
      ].join(" "),
    );
    process.exit(1);
  }

  if (args.skipGithub && !args.skipOpencode && !useOpenCode) {
    console.error(
      [
        "--skip-github requires LLM config: set OPENCODE_API_KEY or OPEN_CODE_API_KEY (or OPENAI_API_KEY for OpenAI-only), plus OPEN_CODE_BASE_URL when not using OPENAI_API_KEY alone,",
        "or pass --skip-opencode (GitHub skipped and no model — nothing useful to do).",
      ].join(" "),
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });

  let q = supabase
    .from("submissions")
    .select(SELECT_COLS)
    .not("repo_url", "is", null)
    .order("created_at", { ascending: true });
  if (args.hackathonId) q = q.eq("hackathon_id", args.hackathonId);
  if (args.analysisStatus) q = q.eq("analysis_status", args.analysisStatus);
  if (args.limit) q = q.limit(args.limit);

  const { data: rows, error: qErr } = await q;
  if (qErr) throw new Error(qErr.message);

  /** @type {typeof rows} */
  const list = rows ?? [];
  let skipped = 0;
  let githubErrors = 0;
  let opencodeErrors = 0;
  let updated = 0;
  let dryWould = 0;
  /** @type {string[]} */
  const logSamples = [];

  for (const row of list) {
    const repoUrlRaw = row.repo_url;
    if (typeof repoUrlRaw !== "string" || !repoUrlRaw.trim()) {
      skipped++;
      console.error(`[skip] ${row.id} empty repo_url`);
      continue;
    }

    const parsed = parseGithubOwnerRepo(repoUrlRaw);
    if (!parsed) {
      skipped++;
      console.error(
        `[skip] ${row.id} not a parseable github.com repo URL: ${repoUrlRaw}`,
      );
      continue;
    }
    const { owner, repo } = parsed;

    /** @type {Record<string, unknown>} */
    const patch = {};
    /** @type {string[]} */
    const analysisNotes = [];

    const fieldGaps =
      isEmpty(row.description) ||
      isEmpty(row.participant_notes) ||
      isEmpty(row.chosen_track) ||
      isEmpty(row.demo_url);

    const shouldRunOpenCode =
      useOpenCode &&
      (fieldGaps || isEmpty(row.ai_text));

    let ghDesc = !isEmpty(row.project_description)
      ? String(row.project_description).trim()
      : "";
    let branch = !isEmpty(row.default_branch)
      ? String(row.default_branch).trim()
      : "";
    let readme = /** @type {string | null} */ (null);

    const needsRepoFetch =
      shouldRunOpenCode ||
      isEmpty(row.project_description) ||
      isEmpty(row.default_branch);
    const needsCommitsFetch = isEmpty(row.total_commits);
    const needsLocFetch =
      isEmpty(row.total_loc_added) || isEmpty(row.total_loc_deleted);
    const needsReadmeFetch = shouldRunOpenCode;

    if (!args.skipGithub && githubToken) {
      const needsGithub =
        needsRepoFetch ||
        needsCommitsFetch ||
        needsLocFetch ||
        needsReadmeFetch;

      if (!needsGithub) {
        console.error(
          `[github-skip] ${row.id} ${owner}/${repo} — GitHub-backed columns already filled (no API calls)`,
        );
      } else {
        try {
          const sig = AbortSignal.timeout(120_000);
          if (needsRepoFetch) {
            const meta = await fetchRepoCore(owner, repo, githubToken, sig);
            const apiDesc =
              typeof meta?.description === "string" ? meta.description : "";
            const apiBranch =
              typeof meta?.default_branch === "string"
                ? meta.default_branch
                : "";
            if (apiDesc.trim()) ghDesc = apiDesc.trim();
            if (apiBranch) branch = apiBranch;
            if (isEmpty(row.project_description) && ghDesc) {
              patch.project_description = ghDesc;
            }
            if (isEmpty(row.default_branch) && branch) {
              patch.default_branch = branch;
            }
          }

          if (needsCommitsFetch) {
            const n = await fetchDefaultBranchCommitCount(
              owner,
              repo,
              githubToken,
              sig,
            );
            if (n != null) {
              patch.total_commits = n;
            }
          }

          if (needsLocFetch) {
            const loc = await fetchCodeFrequencyTotals(
              owner,
              repo,
              githubToken,
              sig,
            );
            if (loc != null) {
              if (isEmpty(row.total_loc_added)) {
                patch.total_loc_added = loc.additions;
              }
              if (isEmpty(row.total_loc_deleted)) {
                patch.total_loc_deleted = loc.deletions;
              }
            }
          }

          if (needsReadmeFetch) {
            readme = await fetchReadmeUtf8(owner, repo, githubToken, sig);
          }
        } catch (e) {
          githubErrors++;
          const msg = e instanceof Error ? e.message : String(e);
          const recordGithub = !(args.githubSoftFail && useOpenCode);
          if (recordGithub) {
            analysisNotes.push(`github:${msg.slice(0, 400)}`);
          }
          console.error(`[github-error] ${row.id} ${owner}/${repo}: ${msg}`);
        }
      }
    }

    let openCodeSucceeded = false;
    if (shouldRunOpenCode) {
      try {
        const user = buildUserPrompt(row, owner, repo, ghDesc, branch, readme);
        const raw = await openCodeChatJsonPrompt(
          openCodeBase,
          opencodeKey,
          openCodeModel,
          SYSTEM_PROMPT,
          user,
          { maxTokens: 900, signal: AbortSignal.timeout(90_000) },
        );
        const parsedJson = safeJsonParse(raw);
        if (!parsedJson || typeof parsedJson !== "object") {
          throw new Error("OpenCode: JSON parse failed");
        }

        const d = /** @type {any} */ (parsedJson).description;
        const pn = /** @type {any} */ (parsedJson).participant_notes;
        const ct = /** @type {any} */ (parsedJson).chosen_track;
        const du = /** @type {any} */ (parsedJson).demo_url;

        if (isEmpty(row.description) && typeof d === "string" && d.trim()) {
          patch.description = d.trim();
        }
        if (
          isEmpty(row.participant_notes) &&
          typeof pn === "string" &&
          pn.trim()
        ) {
          patch.participant_notes = pn.trim();
        }
        if (isEmpty(row.chosen_track) && typeof ct === "string" && ct.trim()) {
          patch.chosen_track = ct.trim();
        }
        if (isEmpty(row.demo_url) && typeof du === "string" && du.trim()) {
          try {
            const u = new URL(du.trim());
            if (u.protocol === "http:" || u.protocol === "https:") {
              patch.demo_url = du.trim();
            }
          } catch {
            /* skip invalid URL */
          }
        }

        patch.ai_text = raw;
        patch.ai_model = openCodeModel;
        patch.ai_generated_at = new Date().toISOString();
        openCodeSucceeded = true;
      } catch (e) {
        opencodeErrors++;
        const msg = e instanceof Error ? e.message : String(e);
        if (isEmpty(row.ai_error)) {
          patch.ai_error = msg.slice(0, 2000);
        }
        analysisNotes.push(`opencode:${msg.slice(0, 400)}`);
        console.error(`[opencode-error] ${row.id} ${owner}/${repo}: ${msg}`);
      }
    }

    const hasPositive = Object.keys(patch).some((k) =>
      POSITIVE_PATCH_KEYS.has(k),
    );

    const promotedStale =
      !openCodeSucceeded &&
      row.analysis_status === "apis_enriched" &&
      !isEmpty(row.ai_text);

    if (openCodeSucceeded) {
      patch.analysis_status = "analyzed";
      patch.analyzed_at = new Date().toISOString();
      patch.analysis_error = null;
      patch.ai_error = null;
    } else if (promotedStale) {
      patch.analysis_status = "analyzed";
      patch.analyzed_at = new Date().toISOString();
      patch.analysis_error = null;
    } else if (hasPositive) {
      patch.analysis_status = "apis_enriched";
      patch.analyzed_at = new Date().toISOString();
    }

    if (!openCodeSucceeded && !promotedStale && analysisNotes.length) {
      patch.analysis_error = analysisNotes.join(" | ").slice(0, 8000);
    }

    const willPersist =
      hasPositive ||
      Object.prototype.hasOwnProperty.call(patch, "analysis_status") ||
      Object.prototype.hasOwnProperty.call(patch, "analysis_error") ||
      Object.prototype.hasOwnProperty.call(patch, "ai_error");

    if (!willPersist) {
      if (args.sleepMs) await sleep(args.sleepMs);
      continue;
    }

    if (args.dryRun) {
      dryWould++;
      if (logSamples.length < 5) {
        logSamples.push(`${row.id} ${owner}/${repo} patch=${JSON.stringify(patch)}`);
      }
      if (args.sleepMs) await sleep(args.sleepMs);
      continue;
    }

    const { error: uErr } = await supabase
      .from("submissions")
      .update(patch)
      .eq("id", row.id);
    if (uErr) {
      console.error(`[db-error] ${row.id}: ${uErr.message}`);
      if (args.sleepMs) await sleep(args.sleepMs);
      continue;
    }
    updated++;

    if (args.sleepMs) await sleep(args.sleepMs);
  }

  console.error(
    [
      args.dryRun ? "[dry-run]" : "[done]",
      `rows=${list.length}`,
      `skipped_non_github=${skipped}`,
      `github_errors=${githubErrors}`,
      `opencode_errors=${opencodeErrors}`,
      args.dryRun ? `would_update≈${dryWould}` : `updated=${updated}`,
    ].join(" "),
  );
  if (args.dryRun && logSamples.length) {
    for (const line of logSamples) console.error(`[sample] ${line}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
