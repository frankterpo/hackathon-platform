# Vercel environment sync

This repo tracks **multiple Vercel projects** for separate hackathon deployments. Environment variables are pulled into **namespaced files** so secrets from each project do not overwrite each other.

## Projects (slugs)

| Slug |
|------|
| `cursor-hackathon-london-2026-1` |
| `cursor-hackathon-london-2026-0` |
| `cursor-hack-london-2026-1` |
| `cursor-thrads-london-2026` |

## CLI installation

The [Vercel CLI](https://vercel.com/docs/cli) is not bundled as a runtime dependency of the Next.js app. Use either:

- **Global:** `npm i -g vercel` (recommended for repeated use), or  
- **One-off:** `npx vercel@latest login` / `npx vercel@latest env pull …`

The scripts in `scripts/` expect `vercel` on your `PATH`. If you only use `npx`, invoke `npx vercel` inside a small wrapper or add the global binary.

## Pull all envs

```bash
vercel login
npm run env:vercel
# or: VERCEL_ENV=development npm run env:vercel
```

This runs `scripts/sync-vercel-envs.sh`, which for each slug:

1. `vercel link --yes --project <slug>`
2. `vercel env pull .env.vercel.<slug> --environment <VERCEL_ENV>`

Outputs:

- `.env.vercel.<slug>` — per-project env file (gitignored via `.env*`)
- `.env.vercel.all.merged` — concatenated snapshot for review (**resolve conflicts manually**; do not commit secrets)

Copy values you need into `.env.local` for this Next.js app; keep deployment-specific values on each Vercel project.
