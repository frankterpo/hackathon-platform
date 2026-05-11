#!/usr/bin/env bash
# Inspect linked Supabase project (table stats + schema dump snippet).
# Prereqs: https://supabase.com/docs/guides/cli — `supabase login` then link.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-wkzczywhgxzttyfzhgck}"
cd "$ROOT"

echo "═══════════════════════════════════════════════════"
echo " Supabase inspect — ref: ${PROJECT_REF}"
echo "═══════════════════════════════════════════════════"
echo ""
echo "If this fails with “not linked”, run:"
echo "  supabase login"
echo "  supabase link --project-ref ${PROJECT_REF}"
echo ""
echo "--- Core tables (from repo migration) ----------------"
echo "  public.hackathons   — events, status, Vercel/Luma/Firebase refs"
echo "  public.submissions  — teams/repos per hackathon_id"
echo "  public.judge_scores — scores per submission_id"
echo ""
echo "--- Remote table statistics (requires linked project) -"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

set +e
supabase inspect db table-stats --linked -o pretty 2>&1
STATS_EXIT=$?
set -e

if [[ "$STATS_EXIT" -ne 0 ]]; then
  echo ""
  echo "(inspect failed — link the project first, commands above)"
  exit "$STATS_EXIT"
fi

DUMP_FILE="${SUPABASE_DUMP_FILE:-}"
if [[ -n "$DUMP_FILE" ]]; then
  echo ""
  echo "Writing schema dump to ${DUMP_FILE} (override path via SUPABASE_DUMP_FILE)"
  mkdir -p "$(dirname "$DUMP_FILE")"
  supabase db dump --linked --schema public -f "$DUMP_FILE"
else
  echo ""
  echo "Tip: SUPABASE_DUMP_FILE=./scratch/public-schema.sql $0"
  echo "     to capture full public schema via pg_dump (file is gitignored under scratch/)."
fi
