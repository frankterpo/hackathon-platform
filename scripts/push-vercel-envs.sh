#!/usr/bin/env bash
# Push the V1 portal envs to Vercel (production + preview).
# Idempotent: overwrites existing values via --force.
# Run once after rotating secrets or adding a new var.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v vercel >/dev/null 2>&1; then
  if command -v npx >/dev/null 2>&1; then
    VERCEL="npx vercel"
  else
    echo "Vercel CLI not found." >&2
    exit 1
  fi
else
  VERCEL="vercel"
fi

# Source secrets from .env.local so we keep one source of truth.
# shellcheck disable=SC1091
set -a
source .env.local
set +a

push() {
  local name="$1"; local value="$2"
  if [ -z "$value" ]; then
    echo "skip $name (empty)"; return 0
  fi
  for env in production preview; do
    $VERCEL env add "$name" "$env" --value "$value" --yes --force >/dev/null 2>&1 \
      && echo "✓ $name → $env" \
      || echo "✗ $name → $env"
  done
}

push NEXT_PUBLIC_SUPABASE_URL          "$NEXT_PUBLIC_SUPABASE_URL"
push SUPABASE_URL                      "$SUPABASE_URL"
push NEXT_PUBLIC_SUPABASE_ANON_KEY     "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
push SUPABASE_ANON_KEY                 "$SUPABASE_ANON_KEY"
push SUPABASE_SERVICE_ROLE_KEY         "$SUPABASE_SERVICE_ROLE_KEY"
push NEXT_PUBLIC_SUPABASE_PROJECT_REF  "$NEXT_PUBLIC_SUPABASE_PROJECT_REF"
push ADMIN_SECRET                      "$ADMIN_SECRET"
push HACK_PAGE_DOMAIN_MAP              "$HACK_PAGE_DOMAIN_MAP"
push BROWSER_USE_API_KEY               "${BROWSER_USE_API_KEY:-}"
push CRON_SECRET                       "${CRON_SECRET:-}"
push FIREBASE_CREDITS_COLLECTION       "${FIREBASE_CREDITS_COLLECTION:-}"
push FIREBASE_SA__cursor_thrads_london_2026 "${FIREBASE_SA__cursor_thrads_london_2026:-}"

echo "Done."
