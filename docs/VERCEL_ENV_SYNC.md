# Vercel environment sync

This repo tracks **multiple Vercel projects** for separate hackathon deployments. Environment variables are pulled into **namespaced files** so secrets from each project do not overwrite each other.

## Projects (slugs)

There is **no default slug list** in git: add Vercel project names to the `PROJECTS` array in `scripts/sync-vercel-envs.sh` (and the same list in `scripts/vercel-env-ls-all.sh`) when you create deployments for this app.

Older London-event slugs (`cursor-hackathon-london-2026-*`, `cursor-hack-london-2026-*`, `cusor-hack-london-2026-1`, etc.) were retired from this repo after those projects were removed or found not to host this App Router surface.

## CLI installation

The [Vercel CLI](https://vercel.com/docs/cli) is not bundled as a runtime dependency of the Next.js app. Use either:

- **Global:** `npm i -g vercel` (recommended for repeated use), or
- **One-off:** `npx vercel@latest login` / `npx vercel@latest env pull …`

Scripts resolve the CLI automatically: **`vercel` on `PATH`**, otherwise **`npx vercel@latest`** (no global install required).

## Pull all envs

```bash
vercel login
npm run env:vercel
# or: VERCEL_ENV=development npm run env:vercel
```

This runs `scripts/sync-vercel-envs.sh`, which for each slug uses **`--non-interactive`** on all CLI calls (older `--yes` on some subcommands is unreliable across CLI versions; `vercel env ls` does not accept `--yes`):

1. `vercel link --non-interactive --project <slug>`
2. `vercel env pull .env.vercel.<slug> --environment <VERCEL_ENV> --non-interactive`

Outputs:

- `.env.vercel.<slug>` — per-project env file (gitignored via `.env*`)
- `.env.vercel.all.merged` — concatenated snapshot for review (**resolve conflicts manually**; do not commit secrets)

## One central `.env.local`

Vercel often sets `SUPABASE_PROJECT_URL`, `SUPABASE_ANON_PUBLIC_KEY`, and `SUPABASE_SERVICE_ROLE_SECRET`. This app uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

After `npm run env:vercel`:

```bash
npm run env:central
```

Merges every `.env.vercel.*` (except `.env.vercel.all.merged`), **last file wins** on duplicate keys, rewrites **`.env.local`**, maps Supabase names, and sets **`NEXT_PUBLIC_SUPABASE_PROJECT_REF`** from the project URL. Values that only lived in the old `.env.local` (e.g. `ADMIN_SECRET`) are kept unless `ENV_CENTRAL_NO_PRESERVE=1`. Restart **`npm run dev`**.

## List keys only (no pull)

Safer audit of what exists per deployment without downloading values:

```bash
vercel login
npm run env:vercel:ls
```

Prefer **`npm run env:central`** to build `.env.local` from pulls; never commit populated `.env*` files.
