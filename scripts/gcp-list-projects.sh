#!/usr/bin/env bash
# List GCP projects (requires gcloud auth).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo "Listing GCP projects (run: gcloud auth login && gcloud auth application-default login as needed):"
echo ""
gcloud projects list --format="table(projectId,name,projectNumber)"
