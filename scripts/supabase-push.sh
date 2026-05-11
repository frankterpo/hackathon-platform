#!/usr/bin/env bash
# Push local migrations to the linked remote database (non-interactive target project via --linked).
# Prerequisites: https://supabase.com/docs/guides/cli — supabase login && supabase link.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

LINKED_REF_FILE="$ROOT/supabase/.temp/project-ref"
if [[ ! -s "$LINKED_REF_FILE" ]]; then
  echo "Not linked: missing supabase/.temp/project-ref."
  echo "Run: supabase login && supabase link --project-ref \"\${SUPABASE_PROJECT_REF}\""
  exit 1
fi

LINKED_REF="$(<"$LINKED_REF_FILE")"
if [[ -n "${SUPABASE_PROJECT_REF:-}" && "$SUPABASE_PROJECT_REF" != "$LINKED_REF" ]]; then
  echo "Linked project ref ($LINKED_REF) does not match SUPABASE_PROJECT_REF ($SUPABASE_PROJECT_REF)."
  exit 1
fi

echo "Linked Supabase project: $LINKED_REF"
echo "Running: supabase db push --linked"
exec supabase db push --linked
