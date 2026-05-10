# Master hackathon platform

Next.js dashboard for operating **multiple hackathons** from one repository. Each event can have its own Vercel project, Luma registration, Firebase config, and shared Supabase data for submissions and judging.

## Consolidation story

- **One repo, many hacks:** Deploy this app once per “control plane,” or reuse it across events; routing and visual **theme** are expected to differ per **Vercel deployment** (env + branding), not per Git branch.
- **Shared pillars:** Participant check-ins and credit flows tie to **Luma** (name/email); **Firebase** console links per project; **Supabase** holds `hackathons`, `submissions`, and `judge_scores` for a single source of truth across events.

## gstack (tooling aggregate)

There is no Cursor `/gstack` command in-repo; use the same name locally:

| Command | What it does |
|--------|----------------|
| `npm run gstack` or `make gstack` | Prints Vercel / Supabase steps; lists GCP projects if `gcloud` is installed. Set `VERCEL_RUN_SYNC=1` to also run full Vercel env pulls. |
| `npm run env:vercel` or `make env-vercel` | Runs `scripts/sync-vercel-envs.sh` for all dashboard Vercel slugs (requires [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel` or `npx vercel@latest`). |
| `npm run gcp:list` | `gcloud projects list` (requires `gcloud auth login`). |
| `npm run dev` | Next.js dev server. |

## Environment variables

See `.env.example`. Required for the dashboard to load data:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (optional if using service role only server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Recommended for this app so `public.hackathons` can be read without permissive RLS policies. |
| `NEXT_PUBLIC_SUPABASE_PROJECT_REF` | Optional; defaults to `wkzczywhgxzttyfzhgck` for Supabase dashboard links |
| `NEXT_PUBLIC_VERCEL_TEAM` | Optional; if set, Vercel links use `https://vercel.com/<team>/<slug>` |

## Supabase

Project ref (from the dashboard URL): **`wkzczywhgxzttyfzhgck`**.

```bash
# https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref wkzczywhgxzttyfzhgck
supabase db push   # apply migrations in supabase/migrations
```

If the remote database already diverged:

```bash
supabase db pull   # capture remote schema; reconcile with migrations as needed
```

Schema lives in `supabase/migrations/` (`hackathons`, `submissions`, `judge_scores`). RLS is enabled without broad anon policies—use the **service role** from the server or add policies later.

## Vercel env sync

See [docs/VERCEL_ENV_SYNC.md](docs/VERCEL_ENV_SYNC.md) for the full list of project slugs and `vercel env pull` workflow.

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
cp .env.example .env.local   # fill in secrets
npm run dev
npm run build
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
