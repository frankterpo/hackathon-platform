# Day 0 — clone to deploy

This page is the shortest path from zero to a running board and admin path. For **Garry Tan gstack** (AI agent slash commands), install [github.com/garrytan/gstack](https://github.com/garrytan/gstack) separately — it does **not** replace this repo’s `npm run stack` pipeline.

## 1. Clone and install

```bash
git clone <your-fork-or-upstream-url> hackathon-platform
cd hackathon-platform
npm install
cp .env.example .env.local
```

Edit `.env.local` with real Supabase URL, anon key, **service role key**, `ADMIN_SECRET`, and optional `NEXT_PUBLIC_VERCEL_TEAM`.

## 2. Agent skills (optional)

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && ./setup --host cursor
```

Use upstream `/review`, `/qa`, `/devex-review`, etc. on branches before shipping.

## 3. Database

### Remote (linked project)

```bash
supabase login
supabase link --project-ref "$NEXT_PUBLIC_SUPABASE_PROJECT_REF"
npm run supabase:apply   # migrations + seed.sql on the linked remote (CLI)
```

Schema-only (no seed): `npm run supabase:push`. Seed runs are idempotent (matched by `theme_slug`).

You can also use **Create hackathon** on `/admin/master-panel` instead of or in addition to seed data.

### Local Supabase (optional)

```bash
supabase db reset   # migrations + seed.sql
```

## 4. QA before commit

```bash
npm run check    # lint + build + smoke-check
```

## 5. Infra helpers (Vercel / GCP)

```bash
npm run stack
# e.g. VERCEL_RUN_SYNC=1 SUPABASE_INSPECT=1 GCP_LIST=1 npm run stack
```

Same script as **`npm run gstack:local`** (local infra naming; **not** [upstream gstack](https://github.com/garrytan/gstack) slash-command skills).

## 6. Run app

```bash
npm run dev
```

- Board: `/`
- Admin + create form: `/admin/master-panel`

## 7. Deploy (Vercel)

Create a Vercel project from the repo; set the same env vars as `.env.example` (including `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_SECRET` if you use the admin form). Then run your usual `vercel deploy` or Git integration.
