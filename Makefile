.PHONY: gstack dev env-vercel gcp-list

# Aggregate toolchain entrypoint (Vercel hints, Supabase notes, GCP list). Optional: VERCEL_RUN_SYNC=1 make gstack
gstack:
	bash scripts/gstack.sh

dev:
	npm run dev

env-vercel:
	bash scripts/sync-vercel-envs.sh

gcp-list:
	bash scripts/gcp-list-projects.sh
