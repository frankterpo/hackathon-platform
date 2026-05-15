#!/usr/bin/env bash
# List env variable NAMES per Vercel project (no bulk pull). Requires vercel login.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v vercel >/dev/null 2>&1; then
  VERCEL=(vercel)
else
  echo "No global \`vercel\` on PATH — using npx vercel@latest"
  VERCEL=(npx vercel@latest)
fi

# Same slugs as scripts/sync-vercel-envs.sh — add slugs when you have Vercel projects to audit.
PROJECTS=(
)

if [[ ${#PROJECTS[@]} -eq 0 ]]; then
  echo "No slugs in PROJECTS — add Vercel project names to scripts/vercel-env-ls-all.sh (same list as sync-vercel-envs.sh)."
  exit 0
fi

for slug in "${PROJECTS[@]}"; do
  echo "═══════════════════════════════════════"
  echo " $slug"
  echo "═══════════════════════════════════════"
  "${VERCEL[@]}" --non-interactive link --project "$slug"
  # Uses linked project context from .vercel/ (cwd); does not dump values remotely.
  # Note: `vercel env ls` does not accept --yes; use global --non-interactive only.
  "${VERCEL[@]}" env ls --non-interactive
  echo ""
done
