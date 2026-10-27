# IronBeat

A private, mobile-first workout music PWA. Instant multi-source search, curated mood decks, a persistent mini-player with lock-screen controls, and per-user playlists — built for the ninety seconds between heavy sets.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Drizzle ORM · Neon PostgreSQL · HTML5 Audio + YouTube IFrame

<p align="center">
  <img src="./docs/screenshots/home.webp" width="230" alt="IronBeat home screen with hero search, Smart Shuffle and the 12-card mood deck" />
  <img src="./docs/screenshots/search.webp" width="230" alt="Instant multi-source search results with the sticky mini player" />
  <img src="./docs/screenshots/player.webp" width="230" alt="Full-screen player with scrubber, transport controls and up-next queue" />
</p>

---

## What it does

| Area | Behaviour |
| --- | --- |
| **Auth** | Email + password, bcrypt (cost 11), opaque session tokens hashed in Postgres. Instant access — no approval queue. |
| **Isolation** | Every playlist, track, favourite and search row is scoped by `user_id`. No cross-tenant read path exists. |
| **Search** | One query fans out to Deezer, Apple Music, the Internet Archive and (optionally) YouTube, then interleaves and de-duplicates the results. |
| **Playback** | Dual backend — `<audio>` for direct streams, YouTube IFrame for full-length video tracks — behind a single state machine. |
| **Continuity** | Selecting any result queues the whole result list, so playback keeps rolling track after track. |
| **Chips** | Successful searches become one-tap quick-launch chips. |
| **Moods** | 12 curated training vibes that expand into live playlists at tap time. |
| **Smart Shuffle** | Builds a one-off mix from your most-searched genres and most-played artists. |
| **PWA** | Web App Manifest, iOS standalone meta, service worker, offline fallback, Media Session for lock screen / AirPods. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (PWA)                                               │
│                                                              │
│  app/*  ── React Server Components ──►  lib/data.ts  ──┐     │
│    │                                                   │     │
│    └── client islands                                  │     │
│         ├── SearchExperience  ──► /api/search          │     │
│         ├── MoodDeck          ──► /api/moods/[slug]    │     │
│         ├── MiniPlayer / FullPlayer                    │     │
│         │      └── AudioEngine (useSyncExternalStore)  │     │
│         │            ├── HTMLAudioElement              │     │
│         │            ├── YouTube IFrame adapter        │     │
│         │            └── Media Session API             │     │
│         └── FavoritesProvider / ToastProvider          │     │
└────────────────────────────────────────────────────────┼─────┘
                                                         │
                       ┌─────────────────────────────────▼──────┐
                       │  Route handlers (app/api/**)           │
                       │  auth · search · playlists · favourites │
                       │  plays · moods · smart-shuffle          │
                       └───────────────┬────────────────────────┘
                                       │
              ┌────────────────────────┼─────────────────────────┐
              │                        │                         │
      ┌───────▼────────┐      ┌────────▼────────┐      ┌─────────▼────────┐
      │ lib/audio/     │      │ lib/data.ts     │      │ lib/auth.ts      │
      │ search.ts      │      │ (Drizzle)       │      │ sessions+bcrypt  │
      │ providers/*    │      └────────┬────────┘      └─────────┬────────┘
      └───────┬────────┘               │                         │
              │                        │                         │
   ┌──────────▼──────────┐   ┌─────────▼─────────┐     ┌─────────▼────────┐
   │ Deezer · iTunes     │   │ Neon (HTTP)  or   │     │ sessions table   │
   │ Archive.org · YT    │   │ node-postgres     │     │ (sha256 tokens)  │
   └─────────────────────┘   └───────────────────┘     └──────────────────┘
```

### Three decisions worth knowing

**1. The player is a framework-agnostic engine, not a React context.**
`lib/audio/engine.ts` owns all transport state and both playback backends. React subscribes with `useSyncExternalStore`, so a `timeupdate` event re-renders only the components reading the clock — not the page tree. Media Session handlers, queue persistence and autoplay-unlock all live in one place instead of being scattered across effects.

**2. Search is a server-side fan-out with per-source status.**
Providers are called in parallel with individual timeouts. A dead source degrades to a reported status rather than failing the request, and the UI shows exactly which catalogues answered. Results are round-robin interleaved so no single provider owns the top of the list, then de-duplicated on normalised `title + artist`.

**3. One-tap playback survives an async search.**
iOS only permits programmatic audio after a real tap. Chips and mood cards need a network round-trip before they know what to play, so `engine.unlock()` primes the audio element synchronously inside the tap with 50 ms of silence. When results land, `play()` is already trusted.

---

## Project structure

```
app/
  api/
    account/                 DELETE — erase account (cascade)
    auth/{login,logout,me,register}/
    favorites/               GET list · POST toggle
    history/plays/           GET recently played · POST log a play
    mix/smart-shuffle/       GET behavioural mix
    moods/[slug]/            GET expanded mood playlist
    playlists/               GET list · POST create
    playlists/[id]/          GET · PATCH · DELETE
    playlists/[id]/tracks/   POST add · DELETE remove
    playlists/[id]/tracks/move/  POST reorder
    search/                  GET unified search
    search/history/          GET chips · DELETE clear
  (auth pages, home, search, playlists, library, account, offline)
  layout.tsx  globals.css  manifest.ts  error.tsx  not-found.tsx
components/
  player/       MiniPlayer · FullPlayer · TrackRow · AddToPlaylistSheet
  search/       SearchExperience · SearchPageView · useTrackSearch
  home/         HomeView · MoodDeck · SmartShuffleCard · RecentRail
  playlists/    PlaylistsView · PlaylistDetailView · PlaylistTrackRow
  providers/    PlayerProvider · FavoritesProvider · ToastProvider
  ui/           Button · Sheet · Artwork · Equalizer
db/
  schema.ts     7 tables, 14 indexes
  index.ts      driver-aware client (Neon HTTP | node-postgres)
drizzle/        0000_init.sql + journal
lib/
  audio/        engine.ts · youtube.ts · search.ts · providers/* · cache.ts
  auth.ts       bcrypt + opaque sessions
  data.ts       every query, always user-scoped
  moods.ts      the 12-mood deck definition
  validation.ts zod schemas
  api.ts        JSON helpers · CSRF check · SQLSTATE extraction
  rate-limit.ts fixed-window limiter
```

---

## Data model

| Table | Purpose | Key constraint |
| --- | --- | --- |
| `users` | Credentials + display name | unique `email` |
| `sessions` | Hashed session tokens, 30-day TTL | unique `token_hash` |
| `playlists` | User folders | index `(user_id, updated_at)` |
| `playlist_tracks` | Denormalised track snapshots + position | unique `(playlist_id, track_id)` |
| `favorite_tracks` | Saved tracks | unique `(user_id, track_id)` |
| `search_history` | Chips + taste signal | unique `(user_id, normalized)` |
| `track_plays` | Play log for recent + Smart Shuffle | index `(user_id, played_at)` |

Track snapshots are intentionally denormalised: a playlist keeps playing even if an upstream catalogue changes shape or delists the item.

---

## Audio sources

| Source | Key required | Playable audio | Notes |
| --- | --- | --- | --- |
| **Deezer** | No | 30 s preview MP3 | Server-side only (CORS blocked in browsers). |
| **Apple Music / iTunes** | No | 30 s preview M4A | Highest availability; previews are honest 0:30 in the UI. |
| **Internet Archive** | No | Full-length MP3 | Two-step: search → item metadata → best MP3. |
| **YouTube** | `YOUTUBE_API_KEY` | Full-length, via official IFrame | Optional. Without a key the other three still work. |

Every preview is labelled `PREVIEW` in the interface so nobody wonders why a track stops at thirty seconds. All four sources are public APIs used within their published terms; YouTube playback goes through the official player rather than stream extraction.

---

## Security model

- **Passwords** — bcrypt, cost 11. Login always performs a hash comparison so response time doesn't reveal whether an account exists.
- **Sessions** — 32 random bytes, base64url in an `httpOnly` `SameSite=Lax` cookie; only the SHA-256 hash is stored. Logout deletes the row, so a stolen cookie dies with it.
- **CSRF** — SameSite=Lax plus an Origin/Host check on every mutating handler.
- **Rate limits** — fixed-window per IP and per account on auth, plus per-user caps on search, moods and mixes.
- **Isolation** — `lib/data.ts` never exposes a "get by id" query; every statement carries `user_id`.
- **Headers** — `nosniff`, `SAMEORIGIN`, strict referrer policy, and a locked-down permissions policy.

---

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run smoke      # end-to-end HTTP test (needs a running server)
npm run icons      # regenerate the PWA icon set
npm run db:generate / db:migrate / db:push / db:studio
```

`scripts/smoke-test.mjs` drives a running instance through 68 assertions: registration, duplicate/weak-password handling, session lifecycle, multi-source search, playlist CRUD + reorder, cross-tenant isolation, favourites, play logging, moods, Smart Shuffle, and every page render. It creates and deletes its own accounts.

```bash
npm run build && npm start &
node scripts/smoke-test.mjs http://localhost:3000
```

---

## Documentation

- **[DEPLOYS_GUIDE.md](./DEPLOYS_GUIDE.md)** — local setup, Neon, environment variables, Vercel deployment, PWA configuration, GitHub integration, troubleshooting.
- **[USER_GUIDE.md](./USER_GUIDE.md)** — sign-up, Add to Home Screen, instant search, chips, moods, folders, lock-screen controls.
