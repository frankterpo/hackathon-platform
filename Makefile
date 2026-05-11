.PHONY: stack check dev env-vercel env-vercel-ls env-central luma-ingest supabase-inspect supabase-push supabase-apply gcp-list

# Infra CLI pipeline (not github.com/garrytan/gstack): VERCEL_RUN_SYNC=1 VERCEL_ENV_LS=1 SUPABASE_INSPECT=1 GCP_LIST=1 make stack
stack:
	bash scripts/platform-stack.sh

check:
	npm run check

dev:
	npm run dev

env-vercel:
	bash scripts/sync-vercel-envs.sh

env-vercel-ls:
	bash scripts/vercel-env-ls-all.sh

env-central:
	node scripts/merge-env-central.mjs

luma-ingest:
	node scripts/ingest-luma-events.mjs

supabase-inspect:
	bash scripts/supabase-inspect.sh

supabase-push:
	bash scripts/supabase-push.sh

supabase-apply:
	bash scripts/supabase-apply-linked.sh

gcp-list:
	bash scripts/gcp-list-projects.sh
