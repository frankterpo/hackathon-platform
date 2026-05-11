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

PROJECTS=(
  "cursor-hackathon-london-2026-1"
  "cursor-hackathon-london-2026-0"
  "cursor-hack-london-2026-1"
  "cursor-thrads-london-2026"
)

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
