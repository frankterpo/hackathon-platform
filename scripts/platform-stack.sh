#!/usr/bin/env bash
# Local infra CLI pipeline for this repo: Vercel → Supabase → GCP (optional steps behind env toggles).
# Named "platform-stack" intentionally — **Garry Tan upstream gstack** is the AI-skills toolkit at https://github.com/garrytan/gstack (slash commands via clone + ./setup); it does not orchestrate these shell steps via gstack.toml.
# Toggles (all optional except the pipeline structure):
#   VERCEL_RUN_SYNC=1   — run scripts/sync-vercel-envs.sh (vercel link + env pull, --non-interactive per slug)
#   VERCEL_ENV_LS=1     — run scripts/vercel-env-ls-all.sh (vercel env ls --non-interactive per slug)
#   SUPABASE_INSPECT=1  — run scripts/supabase-inspect.sh when supabase/.temp/project-ref exists (linked)
#   GCP_LIST=1          — run scripts/gcp-list-projects.sh when gcloud is installed
# Missing CLIs: only then print one-time install/login commands (command -v checks).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-wkzczywhgxzttyfzhgck}"
LINKED_REF_FILE="$ROOT/supabase/.temp/project-ref"

banner() {
  echo ""
  echo "══════════════════════════════════════"
  echo " $1"
  echo "══════════════════════════════════════"
}

echo "hackathon-platform stack — npm run stack (or npm run gstack:local)"
echo "Toggles: VERCEL_RUN_SYNC=1 VERCEL_ENV_LS=1 SUPABASE_INSPECT=1 GCP_LIST=1"
echo ""

banner "1) Vercel"
if ! command -v vercel >/dev/null 2>&1; then
  echo "note — no global \`vercel\` on PATH; sync scripts fall back to \`npx vercel@latest\`."
fi

if [[ "${VERCEL_RUN_SYNC:-}" == "1" ]]; then
  echo "VERCEL_RUN_SYNC=1 → running scripts/sync-vercel-envs.sh …"
  bash "$ROOT/scripts/sync-vercel-envs.sh"
else
  echo "skip sync — set VERCEL_RUN_SYNC=1 to run full env pull (--non-interactive link + env pull per slug)."
  echo "  one-liner: VERCEL_RUN_SYNC=1 npm run stack   # or: npm run env:vercel"
fi

if [[ "${VERCEL_ENV_LS:-}" == "1" ]]; then
  echo "VERCEL_ENV_LS=1 → running scripts/vercel-env-ls-all.sh …"
  bash "$ROOT/scripts/vercel-env-ls-all.sh"
else
  echo "skip env key listing — set VERCEL_ENV_LS=1 (vercel env ls --non-interactive per project slug)."
  echo "  one-liner: VERCEL_ENV_LS=1 npm run stack   # or: npm run env:vercel:ls"
fi

banner "2) Supabase"
if ! command -v supabase >/dev/null 2>&1; then
  echo "skip — supabase CLI not found. One-time:"
  echo "  Install: https://supabase.com/docs/guides/cli"
  echo "  supabase login"
  echo "  supabase link --project-ref ${PROJECT_REF}"
else
  if [[ "${SUPABASE_INSPECT:-}" == "1" ]]; then
    if [[ -s "$LINKED_REF_FILE" ]]; then
      echo "SUPABASE_INSPECT=1 → running scripts/supabase-inspect.sh …"
      bash "$ROOT/scripts/supabase-inspect.sh"
    else
      echo "SUPABASE_INSPECT=1 but repo is not linked (supabase/.temp/project-ref missing)."
      echo "  supabase login"
      echo "  supabase link --project-ref ${PROJECT_REF}"
    fi
  else
    echo "skip inspect — set SUPABASE_INSPECT=1 after supabase link."
    echo "  one-liner: SUPABASE_INSPECT=1 npm run stack   # or: npm run supabase:inspect"
  fi
  echo "  migrations: npm run supabase:push   # supabase db push --linked (requires link)"
fi

banner "3) GCP"
if ! command -v gcloud >/dev/null 2>&1; then
  echo "skip — gcloud not found. One-time:"
  echo "  https://cloud.google.com/sdk/docs/install"
  echo "  gcloud auth login"
  echo "  gcloud auth application-default login   # if APIs need ADC"
else
  if [[ "${GCP_LIST:-}" == "1" ]]; then
    echo "GCP_LIST=1 → running scripts/gcp-list-projects.sh …"
    bash "$ROOT/scripts/gcp-list-projects.sh"
  else
    echo "skip project list — set GCP_LIST=1 for gcloud projects list."
    echo "  one-liner: GCP_LIST=1 npm run stack   # or: npm run gcp:list"
  fi
fi

banner "4) App"
echo "  npm run dev"
echo ""
echo "Done."
