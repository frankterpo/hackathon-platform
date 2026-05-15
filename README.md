# Master hackathon platform

Next.js dashboard for operating **multiple hackathons** from one repository. Each event can have its own Vercel project, Luma registration, Firebase config, and shared Supabase data for submissions and judging.

## TL;DR (new contributors)

1. `git clone` → `npm install` → **`npm run env:vercel`** (optional) → **`npm run env:central`** to build `.env.local` from Vercel pulls — or `cp .env.example .env.local` and fill Supabase + `ADMIN_SECRET` ([Day 0](docs/DAY0.md)).
2. `supabase link` → `npm run supabase:push` → `npm run luma:ingest` to upsert the Luma events, or seed via `supabase/seed.sql` / **Create hackathon** on `/admin/master-panel`.
3. Quality gate: `npm run check` (lint + production build + small repo smoke test).
4. Infra CLI: `npm run stack` (alias: `npm run gstack:local`) or `make stack` — **not** the same as upstream [garrytan/gstack](https://github.com/garrytan/gstack) (AI skills); see below.

## Consolidation story

- **One repo, many hacks:** Deploy this app once per “control plane,” or reuse it across events; routing and visual **theme** are expected to differ per **Vercel deployment** (env + branding), not per Git branch.
- **Shared pillars:** Participant check-ins and credit flows tie to **Luma** (name/email); **Firebase** console links per project; **Supabase** holds `hackathons`, `submissions`, and `judge_scores` for a single source of truth across events.

## Garry Tan gstack (AI workspace skills)

Upstream **[gstack](https://github.com/garrytan/gstack)** (`garrytan/gstack`) is **not** this repo’s Vercel/Supabase CLI driver. It installs **skills and slash-command workflows** (for example `/review`, `/qa`, `/ship`, `/browse`) for Claude Code and other coding agents via **clone + `./setup`**. See the upstream [README](https://github.com/garrytan/gstack/tree/main) for prerequisites (Bun, Git, Claude Code).

**Quick install (Cursor Agent skills):**

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && ./setup --host cursor
```

Default Claude Code onboarding uses `~/.claude/skills/gstack` ([install snippet in upstream README](https://github.com/garrytan/gstack/tree/main)).

**Optional team bootstrap (vendors `.claude/` hooks for shared repos — from upstream README):**

```bash
(cd ~/.claude/skills/gstack && ./setup --team) && ~/.claude/skills/gstack/bin/gstack-team-init required && git add .claude/ CLAUDE.md && git commit -m "require gstack for AI-assisted work"
```

Upstream does **not** ship a **`gstack.toml`** for chaining npm scripts (`env:vercel`, `supabase:push`, GCP). Those steps stay in **`npm run stack`** (`scripts/platform-stack.sh`). Optional upstream global settings live in **`~/.gstack/config.yaml`**.

**Naming:** This repo avoids an `npm run gstack` script so **gstack** refers to upstream ([github.com/garrytan/gstack](https://github.com/garrytan/gstack)). The infra runner is **`npm run stack`**; **`npm run gstack:local`** is an alias for the same bash script.

## Infra CLI (`stack`)

Older docs used **`npm run gstack` / `make gstack`** for this pipeline — use **`npm run stack`** / **`make stack`** (or **`npm run gstack:local`**) instead.

**Master command:** `npm run stack` or `npm run gstack:local` or `make stack` — ordered pipeline (Vercel → Supabase → GCP → app hint). Default steps print **skip** + a one-liner; optional work runs only when set:

| Env toggle           | Effect                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERCEL_RUN_SYNC=1`  | Runs `scripts/sync-vercel-envs.sh` (`vercel link` + `vercel env pull --environment=…`, both `--non-interactive`; falls back to `npx vercel@latest` if `vercel` is not on `PATH`). |
| `VERCEL_ENV_LS=1`    | Lists env **keys** per slug (`scripts/vercel-env-ls-all.sh`; `vercel env ls --non-interactive`).                                                                                  |
| `SUPABASE_INSPECT=1` | Runs `scripts/supabase-inspect.sh` if `.supabase/` exists (after `supabase link`); otherwise prints link instructions.                                                            |
| `GCP_LIST=1`         | Runs `scripts/gcp-list-projects.sh` if `gcloud` is installed.                                                                                                                     |

If `supabase` or `gcloud` is missing, **only then** the stack script prints install/login one-liners for that tool. Vercel sync scripts use **`npx vercel@latest`** when `vercel` is not installed globally.

**Example:** `VERCEL_RUN_SYNC=1 SUPABASE_INSPECT=1 GCP_LIST=1 npm run stack`

| Command                                               | What it does                                                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run env:vercel` or `make env-vercel`             | Same as sync script: all dashboard Vercel slugs → `.env.vercel.<slug>` ([Vercel CLI](https://vercel.com/docs/cli)).               |
| `npm run env:central`                                 | Merge all `.env.vercel.*` into **one** `.env.local` with canonical Supabase names (`NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`). |
| `npm run env:vercel:ls` or `make env-vercel-ls`       | Env variable names per slug (no value pull).                                                                                      |
| `npm run supabase:inspect` or `make supabase-inspect` | Table stats + optional `SUPABASE_DUMP_FILE=` schema dump when linked.                                                             |
| `npm run supabase:push` or `make supabase-push`       | `supabase db push --linked` — **`supabase link` first** (creates `.supabase/`).                                                   |
| `npm run gcp:list` or `make gcp-list`                 | `gcloud projects list`.                                                                                                           |
| `npm run dev`                                         | Next.js dev server.                                                                                                               |

## Environment variables

See `.env.example`. Required for the dashboard to load data:

| Variable                           | Purpose                                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | Supabase API URL                                                                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Public anon key (optional if using service role only server-side)                                                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`        | **Server-only.** Recommended for this app so `public.hackathons` can be read without permissive RLS policies.                                                                |
| `NEXT_PUBLIC_SUPABASE_PROJECT_REF` | Optional; used for Supabase dashboard links (defaults to a project ref in code if unset — set explicitly in production)                                                      |
| `NEXT_PUBLIC_VERCEL_TEAM`          | Optional; if set, Vercel links use `https://vercel.com/<team>/<slug>`                                                                                                        |
| `ADMIN_SECRET`                     | Shared passphrase for the **Create hackathon** form on `/admin/master-panel`. Compared server-side; use a strong value in hosted environments.                               |
| `NEXT_PUBLIC_USE_MOCK_HACKATHONS`  | Optional · development only · set to `1` with `npm run dev` to show placeholder Kanban rows when the DB is empty or after a failed query (see `src/lib/supabase/server.ts`). |
| `LUMA_AUTH_TOKEN` / `LUMA_COOKIE`  | Optional local-only fallback for `npm run luma:ingest` if a Luma page ever requires session auth. Do not print, save, or commit real values.                                 |

## Supabase

Use the project ref from the Supabase dashboard URL as `NEXT_PUBLIC_SUPABASE_PROJECT_REF` / `supabase link --project-ref`.

```bash
# https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # same ref as in `https://YOUR_PROJECT_REF.supabase.co`
npm run supabase:push   # supabase db push --linked; requires link above
```

**Lookup integration migration:** `supabase/migrations/20260516183000_integration_lookup_tables.sql` adds `public.luma_events`, `public.firebase_projects`, and FK columns on `hackathons`. PostgREST embeds depend on those FKs; without them you may see **Could not find a relationship between 'hackathons' and 'luma_events'**. The board loaders fall back to non-embed selects when that error appears, but hosted environments should still run **`npm run supabase:push`** so cron and admin paths match the repo schema.

After the first migration, load demo rows using one of:

- **Local Supabase (Docker):** from the repo root, `supabase db reset` (applies migrations and `supabase/seed.sql`).
- **Hosted project:** open the Supabase SQL editor for the linked project and paste or run `supabase/seed.sql`, **or** pipe the file with `psql` using the connection string from Dashboard → **Connect** (e.g. `psql "postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres" -f supabase/seed.sql`).

Alternatively, create rows from **`/admin/master-panel`** using `ADMIN_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`.

### Luma ingestion

The ingestion script fetches public Luma event pages, reads the page `__NEXT_DATA__` payload, and upserts normalized metadata into `public.hackathons` by `luma_url`. It stores the public URL/slug, Luma event API id, title, start/end timestamps, timezone, location, description, and a sanitized raw payload. Re-runs preserve existing `vercel_project_slug` and `firebase_config_ref` values. Auth is not required for the four current event pages; if Luma later gates one, set `LUMA_AUTH_TOKEN` or `LUMA_COOKIE` locally and the script will send it without logging it.

```bash
npm run supabase:push
npm run luma:ingest

# Optional: override the default four events
npm run luma:ingest -- https://luma.com/b6jccpfu
```

Default events:

- Completed: `https://luma.com/1ufgfhvv`, `https://luma.com/2ohizf10`
- Scheduled: `https://luma.com/b6jccpfu`, `https://luma.com/wl7a90xe`

For `b6jccpfu`, ingestion creates/updates a scheduled row with theme slug `b6jccpfu-cursor-adtech-london-hackathon`. Fill `vercel_project_slug` and `firebase_config_ref` once those project ids are known.

If the remote database already diverged from `supabase/migrations/` (for example different column names on `public.hackathons`), align before relying on the dashboard:

```bash
supabase db pull   # capture remote schema; reconcile migrations vs dashboard SQL editor changes
```

After reconciliation, keep migrations as the source of truth (`hackathons`, `submissions`, `judge_scores`). RLS is enabled without broad anon policies—the Next.js server uses **`SUPABASE_SERVICE_ROLE_KEY` first**, which bypasses RLS; anon-only setups need explicit policies or queries will return empty/errors.

## Vercel env sync

See [docs/VERCEL_ENV_SYNC.md](docs/VERCEL_ENV_SYNC.md) for the `vercel env pull` workflow; register each deployment’s slug in `scripts/sync-vercel-envs.sh` when you add Vercel projects.

## GCP

Project listing uses the Google Cloud SDK:

```bash
gcloud auth login
gcloud auth application-default login   # if APIs need ADC
npm run gcp:list
```

## Local development

```bash
npm install
cp .env.example .env.local   # fill in secrets (Supabase + ADMIN_SECRET for admin form)
npm run dev
```

Server Components read `process.env` on each request; Next merges `.env`, `.env.local`, and `.env.development.local` (see [Next.js env docs](https://nextjs.org/docs/app/guides/environment-variables)). Restart the dev server after changing env files.

- **Dashboard:** `/` — public radar; **`/admin/master-panel`** — Kanban plus **Create hackathon** (guarded by `ADMIN_SECRET`; no full user auth in this skeleton).

```bash
npm run check    # lint + build + smoke test (same as CI-friendly gate)
```

```bash
npm run build
```

Uses `next build --webpack` in `package.json` so production builds stay reliable in CI (the default Turbopack build hit intermittent filesystem races in some environments).

### From clone to deploy (gstack + this repo)

1. **Install upstream gstack** (optional AI workflows): [github.com/garrytan/gstack](https://github.com/garrytan/gstack) — `git clone … && ./setup --host cursor`. Use slash commands like `/qa` against your preview URL and `/devex-review` on the branch.
2. **Bootstrap this app:** follow [docs/DAY0.md](docs/DAY0.md) (`npm install`, `.env.local`, `supabase link`, `npm run supabase:push`, seed or admin form).
3. **Ship:** `npm run check`, then `vercel` / your Git integration with production env vars.

**Infra CLI vs gstack:** `npm run stack` runs **this repository’s** `scripts/platform-stack.sh` (Vercel/Supabase/GCP helpers). Upstream **gstack** is only the skills toolkit — there is no requirement to run both for the app to work.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
