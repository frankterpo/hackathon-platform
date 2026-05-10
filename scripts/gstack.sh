#!/usr/bin/env bash
# Aggregate local tooling hints and cheap checks (no full Vercel pull unless VERCEL_RUN_SYNC=1).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "══════════════════════════════════════"
echo " gstack — hackathon platform toolchain"
echo "══════════════════════════════════════"
echo ""

echo "1) Vercel environment sync"
echo "   Pull env for all dashboard projects into .env.vercel.<slug> files:"
echo "   npm run env:vercel   (requires: npm i -g vercel && vercel login)"
if [[ "${VERCEL_RUN_SYNC:-}" == "1" ]]; then
  echo "   VERCEL_RUN_SYNC=1 → running sync now..."
  bash "$ROOT/scripts/sync-vercel-envs.sh"
fi
echo ""

echo "2) Supabase"
echo "   supabase login"
echo "   supabase link --project-ref wkzczywhgxzttyfzhgck"
echo "   supabase db push"
echo "   # After linking, if remote changed: supabase db pull"
echo ""

echo "3) GCP projects"
if command -v gcloud >/dev/null 2>&1; then
  bash "$ROOT/scripts/gcp-list-projects.sh" || true
else
  echo "   gcloud not installed — https://cloud.google.com/sdk/docs/install"
  echo "   Then: gcloud auth login"
fi

echo ""
echo "4) App dev server: npm run dev"
echo "Done."
