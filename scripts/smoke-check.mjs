#!/usr/bin/env node
/**
 * Lightweight repo sanity check (no Supabase required for filesystem checks).
 * Run via npm test / npm run check.
 *
 * `.env.example`: every active `VAR=value` line must be preceded (skipping blank lines)
 * by a `# ...` documentation comment.
 *
 * Build output: if `.next/` exists, `.next/BUILD_ID` must exist (incomplete build / stale dir).
 * Optional: `SMOKE_EXPECT_DOT_NEXT=1` — require `.next/` to exist (CI after `npm run build`).
 *
 * Optional HTTP checks (requires a running app: `npm run build && npm run start`, or dev server):
 *   SMOKE_BASE_URL       — e.g. http://127.0.0.1:3000 (no trailing slash required)
 *   SMOKE_HACKATHON_ID   — optional UUID for GET /admin/hackathons/:id/tasks; defaults to a
 *                          stable placeholder. Expect 200 if the hackathon exists, or 404
 *                          when missing / Supabase unavailable — both prove the route is wired.
 * Live Supabase is not required for HTTP smoke: `/` should return 200 with an empty board when
 * env keys are absent; admin tasks often 404 without a real row.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const requiredPaths = [
  "package.json",
  ".env.example",
  ".gitignore",
  "next.config.ts",
  "tsconfig.json",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/admin/master-panel/page.tsx",
  "src/app/admin/hackathons/[id]/tasks/page.tsx",
  "src/app/credits/hackathon/page.tsx",
  "src/components/HackathonTasksClient.tsx",
  "src/components/HackathonCard.tsx",
  "supabase/migrations/20250510120000_initial_schema.sql",
  "supabase/migrations/20260514140000_hackathon_tasks_and_agent_runs.sql",
  "supabase/seed.sql",
];

/** Substrings that must appear (static QA for key admin/task routes). */
const contentChecks = [
  {
    rel: "supabase/migrations/20260514140000_hackathon_tasks_and_agent_runs.sql",
    includes: ["create table if not exists public.hackathon_tasks"],
  },
  {
    rel: "src/components/HackathonCard.tsx",
    includes: ["Admin · tasks", "`/admin/hackathons/${hack.id}/tasks`"],
  },
  {
    rel: "src/components/HackathonTasksClient.tsx",
    includes: ["HackathonTasksClient"],
  },
  {
    rel: "src/app/admin/hackathons/[id]/tasks/page.tsx",
    includes: ["HackathonTasksClient", "loadHackathonTasks"],
  },
];

let failed = false;

function err(msg) {
  console.error(msg);
  failed = true;
}

for (const rel of requiredPaths) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    err(`smoke-check: missing required path ${rel}`);
  }
}

function assertGitignoreIgnoresNext() {
  const p = join(root, ".gitignore");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  if (!/(^|\n)\/?\.next\/?(\/|$)/m.test(text)) {
    err("smoke-check: .gitignore should ignore Next.js build output (.next/)");
  }
}

function validateEnvExampleComments() {
  const p = join(root, ".env.example");
  const lines = readFileSync(p, "utf8").split(/\r?\n/);
  let prevNonEmpty = null;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("#")) {
      prevNonEmpty = trimmed;
      continue;
    }
    const m = trimmed.match(/^([A-Z][A-Z0-9_]*)=/);
    if (m) {
      if (prevNonEmpty === null || !prevNonEmpty.startsWith("#")) {
        err(
          `smoke-check: .env.example:${i + 1} — ${m[1]} must be preceded by a # documentation comment (blank lines allowed between).`,
        );
      }
    }
    prevNonEmpty = trimmed;
  }
}

function checkDotNextArtifact() {
  const dotNext = join(root, ".next");
  const buildId = join(dotNext, "BUILD_ID");
  if (process.env.SMOKE_EXPECT_DOT_NEXT === "1" && !existsSync(dotNext)) {
    err(
      "smoke-check: SMOKE_EXPECT_DOT_NEXT=1 but .next/ is missing (run npm run build first).",
    );
    return;
  }
  if (!existsSync(dotNext)) return;
  if (!existsSync(buildId)) {
    err(
      "smoke-check: .next/ exists but .next/BUILD_ID is missing — run `npm run build` or delete `.next/`.",
    );
  }
}

function runContentChecks() {
  for (const { rel, includes } of contentChecks) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    const body = readFileSync(p, "utf8");
    for (const needle of includes) {
      if (!body.includes(needle)) {
        err(
          `smoke-check: ${rel} must contain substring: ${JSON.stringify(needle)}`,
        );
      }
    }
  }
}

assertGitignoreIgnoresNext();
validateEnvExampleComments();
checkDotNextArtifact();
runContentChecks();

const baseRaw = process.env.SMOKE_BASE_URL?.trim();
if (baseRaw) {
  const base = baseRaw.replace(/\/+$/, "");
  const timeoutMs = 12_000;
  const hackathonId =
    process.env.SMOKE_HACKATHON_ID?.trim() ||
    "00000000-0000-4000-8000-000000000001";

  async function getStatus(path) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(new URL(path, `${base}/`), {
        signal: ctl.signal,
        redirect: "follow",
        headers: { accept: "text/html,*/*" },
      });
      return res.status;
    } finally {
      clearTimeout(t);
    }
  }

  console.log(`smoke-check: HTTP checks against ${base}`);

  try {
    const home = await getStatus("/");
    if (home !== 200) {
      err(`smoke-check: GET / expected 200, got ${home}`);
    } else {
      console.log("smoke-check: GET / → 200");
    }
  } catch (e) {
    err(`smoke-check: GET / failed: ${e?.message ?? e}`);
  }

  try {
    const creditsHackathon = await getStatus("/credits/hackathon");
    if (creditsHackathon !== 200) {
      err(
        `smoke-check: GET /credits/hackathon expected 200 (after redirects), got ${creditsHackathon}`,
      );
    } else {
      console.log("smoke-check: GET /credits/hackathon → 200");
    }
  } catch (e) {
    err(`smoke-check: GET /credits/hackathon failed: ${e?.message ?? e}`);
  }

  const adminPath = `/admin/hackathons/${encodeURIComponent(hackathonId)}/tasks`;
  try {
    const adminStatus = await getStatus(adminPath);
    if (adminStatus === 200 || adminStatus === 404) {
      console.log(
        `smoke-check: GET ${adminPath} → ${adminStatus} (200 or 404 acceptable)`,
      );
    } else {
      err(
        `smoke-check: GET ${adminPath} expected 200 or 404, got ${adminStatus}`,
      );
    }
  } catch (e) {
    err(`smoke-check: GET ${adminPath} failed: ${e?.message ?? e}`);
  }
} else {
  console.log(
    "smoke-check: skip HTTP checks (set SMOKE_BASE_URL when a server is running)",
  );
}

if (failed) {
  process.exit(1);
}

console.log("smoke-check: ok");
