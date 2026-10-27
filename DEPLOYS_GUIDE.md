# IronBeat — Deployment Guide

Everything needed to run IronBeat locally, wire it to a Neon database, and ship it to Vercel.

**Contents**

1. [Prerequisites](#1-prerequisites)
2. [Clone and install](#2-clone-and-install)
3. [Create the Neon database](#3-create-the-neon-database)
4. [Environment variables](#4-environment-variables)
5. [Run migrations](#5-run-migrations)
6. [Run locally](#6-run-locally)
7. [Enable YouTube (optional)](#7-enable-youtube-optional)
8. [Deploy to Vercel](#8-deploy-to-vercel)
9. [PWA settings](#9-pwa-settings)
10. [GitHub integration](#10-github-integration)
11. [Post-deploy checklist](#11-post-deploy-checklist)
12. [Troubleshooting](#12-troubleshooting)
13. [Alternative: self-hosted Postgres](#13-alternative-self-hosted-postgres)

---

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 20.9+ (22 LTS recommended) | `node -v` |
| npm | 10+ | `npm -v` |
| Git | any recent | `git --version` |
| Neon account | free tier is enough | [neon.tech](https://neon.tech) |
| Vercel account | Hobby tier is enough | [vercel.com](https://vercel.com) |

No Docker, no local Postgres and no build tools are required — the Neon HTTP driver talks to Postgres over HTTPS.

---

## 2. Clone and install

```bash
git clone https://github.com/WRusher24/IronBeat2.git
cd IronBeat2
npm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored. Never commit real credentials.

---

## 3. Create the Neon database

1. Sign in at [console.neon.tech](https://console.neon.tech) and **Create project**.
   - Name: `ironbeat`
   - Postgres version: **17** (16 works too)
   - Region: pick the one closest to your Vercel region (e.g. `aws-eu-central-1` ↔ `fra1`)
2. Open **Connect** and copy the connection string. It looks like:

   ```
   postgresql://neondb_owner:AbC123@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

3. **Use the pooled string.** On the Connect panel, toggle **Connection pooling** on. The host then contains `-pooler`:

   ```
   postgresql://neondb_owner:AbC123@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

   Serverless functions open many short-lived connections; the pooler prevents "too many connections" errors under load.

> **Which driver does IronBeat use?**
> URLs containing `.neon.tech` automatically use `@neondatabase/serverless` over HTTP — no TCP handshake, ideal for cold starts. Any other host (local Postgres, Supabase, RDS) automatically uses `node-postgres`. You can force a driver with `DATABASE_DRIVER=neon-http` or `DATABASE_DRIVER=pg`.

---

## 4. Environment variables

Edit `.env.local`:

```dotenv
# Required — Neon pooled connection string
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Required — public origin, no trailing slash.
# Local: http://localhost:3000 · Production: https://your-app.vercel.app
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional — adds YouTube as a fourth search source (full-length playback)
YOUTUBE_API_KEY=""

# Optional — set to "true" to close public registration
SIGNUPS_DISABLED="false"
```

| Variable | Required | Purpose | Where it is used |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string | `db/index.ts`, `drizzle.config.ts` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Absolute origin for metadata, Open Graph and Media Session artwork | `app/layout.tsx` |
| `YOUTUBE_API_KEY` | — | Enables the YouTube search provider | `lib/audio/providers/youtube.ts` |
| `SIGNUPS_DISABLED` | — | Locks `/api/auth/register` while leaving login open | `app/api/auth/register/route.ts` |
| `DATABASE_DRIVER` | — | `neon-http` or `pg` to override auto-detection | `db/index.ts` |
| `DATABASE_POOL_MAX` | — | `pg` pool size (default 8) | `db/index.ts` |

`NEXT_PUBLIC_APP_URL` must match the URL users actually visit. If it is wrong, lock-screen artwork and the manifest's absolute URLs point at the wrong host.

---

## 5. Run migrations

The initial migration is committed at `drizzle/0000_init.sql`.

**Locally:**

```bash
npm run db:migrate
```

You should see:

```
→ Migrating ep-xxxx-pooler.eu-central-1.aws.neon.tech (Neon)
✓ Migrations applied — 7/7 tables ready
```

**On Vercel:** nothing to do. The `vercel-build` script in `package.json` runs `node scripts/migrate.mjs` before `next build`, so every deploy applies any pending migration first. Migrations are tracked in `drizzle.__drizzle_migrations` and are safe to re-run.

> If you explicitly set a **Build Command** in Vercel → Settings → Build & Development Settings, that value replaces `vercel-build`. Either clear it (recommended) or set it to `npm run vercel-build`.

Verify the schema:

```bash
curl -s https://your-app.vercel.app/api/health | jq
```

```json
{
  "ok": true,
  "database": "ready",
  "tables": { "present": 7, "expected": 7, "missing": [] },
  "sources": { "youtube": true },
  "latencyMs": 41
}
```

`/api/health` returns **503** with a `database` field of `uninitialised`, `unreachable` or `not_configured` when something is wrong — it is the fastest way to tell a missing schema apart from a bad connection string.

Other commands:

| Command | Use it when |
| --- | --- |
| `npm run db:generate` | You changed `db/schema.ts` and need a new SQL migration |
| `npm run db:migrate` | Applying committed migrations (local, CI, or manually) |
| `npm run db:push` | Prototyping — syncs the schema without a migration file |
| `npm run db:studio` | Browse the data at https://local.drizzle.studio |

> `scripts/migrate.mjs` reads `.env.local` first, then `.env`, and falls back to real environment variables (which is how it runs on Vercel).

---

## 6. Run locally

```bash
npm run dev
```

Open <http://localhost:3000> → you will be redirected to `/login`. Create an account; you land in your vault immediately.

Verify the whole stack end to end:

```bash
# in a second terminal
node scripts/smoke-test.mjs http://localhost:3000
```

The suite registers disposable accounts, exercises search, playlists, favourites, isolation and moods, then deletes everything it created. Expect `68 passed, 0 failed`.

Other checks:

```bash
npm run typecheck
npm run build
```

> If `next build` fails with `EPERM ... .next/trace` on Windows, build into a fresh directory:
> `NEXT_DIST_DIR=.next-build npm run build`. This is a Windows file-lock quirk, not an application error.

---

## 7. Enable YouTube (optional)

Without a key IronBeat searches Deezer, Apple Music and the Internet Archive — roughly 90 % of the catalogue people look for. Adding YouTube unlocks full-length tracks and video-only releases.

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **Credentials → Create credentials → API key**.
4. Restrict the key: **API restrictions → YouTube Data API v3** only.
5. Put it in `.env.local` as `YOUTUBE_API_KEY` and restart the dev server.

Quota note: each search costs 100 units of the default 10,000/day allowance (≈100 searches/day), plus 1 unit for the duration lookup. Results are cached in-process for 10 minutes, which helps on repeat queries. The UI degrades gracefully if the quota runs out — the source simply reports an error status.

---

## 8. Deploy to Vercel

### Option A — Dashboard (recommended for the first deploy)

1. Push the repository to GitHub (see [§10](#10-github-integration)).
2. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select `WRusher24/IronBeat2`.
3. Framework preset is detected as **Next.js**. Leave build settings at their defaults:
   - Build command: **leave empty** — Vercel picks up `vercel-build` (`migrate && next build`)
   - Output directory: `.next`
   - Install command: `npm install`
4. Add environment variables (Production **and** Preview):

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | your Neon **pooled** connection string |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` |
   | `YOUTUBE_API_KEY` | optional |

5. **Deploy.**
6. After the first deploy, copy the production URL, update `NEXT_PUBLIC_APP_URL` to it, and **Redeploy** (Deployments → ⋯ → Redeploy). This second pass is required because the value is baked into server-rendered metadata.

### Option B — CLI

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add YOUTUBE_API_KEY production   # optional
vercel --prod
```

### Region

Serverless functions should sit near the database. Set the region in the Vercel project (Settings → Functions → Region) to match your Neon region. A `fra1` function talking to `eu-central-1` Neon adds ~10 ms per query; crossing the Atlantic adds ~120 ms.

### Custom domain

Settings → Domains → add your domain, then update `NEXT_PUBLIC_APP_URL` to `https://your-domain.com` and redeploy.

---

## 9. PWA settings

IronBeat ships its PWA configuration in code — no dashboard toggles needed.

| Piece | File | What it does |
| --- | --- | --- |
| Manifest | `app/manifest.ts` → `/manifest.webmanifest` | `display: standalone`, portrait, cream theme, 192/512/maskable icons, three app shortcuts |
| iOS meta | `app/layout.tsx` | `apple-mobile-web-app-capable`, status bar style, `apple-touch-icon` |
| Viewport | `app/layout.tsx` | `viewport-fit=cover` for notch/safe-area handling |
| Service worker | `public/sw.js` | Precaches the shell, network-first navigations, cache-first static assets, `/offline` fallback |
| Registration | `components/pwa/ServiceWorkerRegistrar.tsx` | Registers `/sw.js` in production only |
| Headers | `next.config.ts` | `Cache-Control: no-cache` + `Service-Worker-Allowed: /` on `/sw.js` |
| Icons | `public/icons/*` | Generated from one vector source via `npm run icons` |

### Requirements

- **HTTPS is mandatory.** Service workers and Media Session do not run on plain HTTP (localhost is exempt). Vercel provides TLS automatically.
- **Icons must stay 192×192 and 512×512 PNGs.** iOS ignores anything else for `apple-touch-icon`.
- **`/sw.js` must not be cached aggressively** — the `next.config.ts` header handles this. If you deploy behind another CDN, replicate that rule.

### Verify the install

1. Open the deployed URL in Safari on iPhone.
2. Share → **Add to Home Screen** → the IronBeat icon appears.
3. Launch from the home screen: no browser chrome, cream status bar, fullscreen.
4. Play a track, lock the phone → artwork, title and transport controls appear on the lock screen.
5. Turn on airplane mode and reload → the offline screen appears instead of a browser error.

### Bumping the service worker

`public/sw.js` starts with `const VERSION = "ironbeat-v1"`. Change it whenever you alter caching behaviour; the `activate` handler deletes every cache that doesn't match the new prefix.

---

## 10. GitHub integration

The repository is already initialised and pushed to `main`.

### First push (if starting from a fresh clone)

```bash
git init
git add .
git commit -m "feat: IronBeat workout music PWA"
git branch -M main
git remote add origin https://github.com/WRusher24/IronBeat2.git
git push -u origin main
```

### Connect Vercel to GitHub

1. Vercel → your project → **Settings → Git** → confirm the repository is linked.
2. **Production branch:** `main`.
3. Every push to `main` triggers a production deploy; every pull request gets an isolated preview URL.
4. Preview deployments need the same environment variables. Either mark them **All Environments**, or scope them to Preview with a separate Neon branch.

### Recommended: Neon branching for previews

Neon can create a database branch per PR so preview deployments never touch production data:

1. Neon Console → **Branches** → create `preview` from `main`.
2. In Vercel, add `DATABASE_URL` scoped to **Preview** pointing at the branch's connection string.
3. Migrations for preview branches: run `npm run db:migrate` against the branch URL, or use the Neon-Vercel integration to automate it.

### CI suggestion

A minimal workflow that blocks merges on type or build errors:

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_APP_URL: https://example.com
```

---

## 11. Post-deploy checklist

- [ ] `NEXT_PUBLIC_APP_URL` equals the live URL (no trailing slash)
- [ ] `DATABASE_URL` uses the **pooled** host (`-pooler`)
- [ ] `/api/health` returns `200` with `database: "ready"`
- [ ] Sign-up works and lands directly in the vault (no approval step)
- [ ] Search returns results from at least two sources
- [ ] Playing a result auto-advances to the next track
- [ ] Recent chips appear after a successful search
- [ ] A mood card starts playing within a few seconds
- [ ] Playlist create → add track → reorder → delete works
- [ ] A second account cannot see the first account's folders
- [ ] iPhone: Add to Home Screen gives a fullscreen app
- [ ] Lock screen shows artwork and responds to play/pause/next
- [ ] `/offline` renders when the network is off
- [ ] `node scripts/smoke-test.mjs https://your-app.vercel.app` passes

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| **"Could not create your account. Please try again."** on a fresh deploy | Database has no schema — migrations never ran | `curl /api/health` → if `database: "uninitialised"`, run `npm run db:migrate` against that database and redeploy |
| `relation "users" does not exist` in the logs | Same as above | Same as above |
| `/api/health` → `database: "unreachable"` | Bad `DATABASE_URL`, deleted Neon project, or a paused branch | Re-copy the connection string; check the Neon console |
| `/api/health` → `database: "not_configured"` | `DATABASE_URL` missing from the deployment's environment | Add it, then **Redeploy** (env changes need a new build) |
| `DATABASE_URL is not configured` | Env file missing or not loaded | Create `.env.local`; restart `npm run dev` |
| `relation "users" does not exist` (local) | Migrations not applied | `npm run db:migrate` |
| Search returns only Archive.org | Deezer/iTunes blocked or rate-limited | Check the source badges under the result count; retry in a minute |
| "No audio found" for everything | All providers failed (offline / corporate proxy) | Check the network tab for `/api/search` |
| Tracks stop at 0:30 | Expected — Deezer and Apple Music expose 30 s previews | Add `YOUTUBE_API_KEY` for full-length playback |
| Play button does nothing on iPhone | Autoplay blocked | The player shows a "Tap to start" overlay; tap it once |
| Lock screen shows no artwork | `NEXT_PUBLIC_APP_URL` wrong or artwork host unreachable | Fix the URL and redeploy |
| `too many connections` | Unpooled connection string on serverless | Use the `-pooler` host |
| Service worker serves a stale build | Cache version unchanged | Bump `VERSION` in `public/sw.js` and redeploy |
| `EPERM ... .next/trace` on Windows build | Windows file lock on the Next cache | `NEXT_DIST_DIR=.next-build npm run build` |
| Sign-up returns 500 | Database unreachable or migrations missing | Check the Vercel function log; re-run migrations |
| Sign-up returns 403 | `SIGNUPS_DISABLED="true"` | Set it to `false` and redeploy |

### Reading logs

- **Local:** the terminal running `npm run dev`.
- **Vercel:** Project → Logs → filter by `/api/...`. Server errors are prefixed `[register]`, `[search]`, `[mood]`, `[smart-shuffle]`.

---

## 13. Alternative: self-hosted Postgres

IronBeat is not locked to Neon. Any Postgres 14+ instance works:

```dotenv
DATABASE_URL="postgresql://ironbeat:secret@localhost:5432/ironbeat"
DATABASE_DRIVER="pg"
```

```bash
createdb ironbeat
npm run db:migrate
npm run dev
```

The driver is chosen automatically: `.neon.tech` hosts use the HTTP driver, everything else uses `node-postgres` with a pooled client (8 connections by default, tunable with `DATABASE_POOL_MAX`). Both paths run identical queries.
