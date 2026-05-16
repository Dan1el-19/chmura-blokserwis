# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # dev server (also runs sdk:link)
pnpm build        # production build
pnpm deploy       # build + wrangler deploy to Cloudflare Workers
pnpm check        # svelte-check type checking
pnpm lint         # prettier + eslint
pnpm format       # prettier write
pnpm test:unit    # vitest (two projects: server + client/browser)
pnpm test:e2e     # playwright
pnpm test         # unit + e2e
pnpm db:init      # initialize Appwrite database schema
pnpm r2:abort     # emergency: abort all in-progress R2 multipart uploads
```

Run a single test file: `pnpm test:unit -- src/path/to/file.spec.ts`

## Architecture

SvelteKit app deployed as a **Cloudflare Worker** (`@sveltejs/adapter-cloudflare`). All server-side code runs in the Workers runtime.

### External services

| Service | Purpose |
|---|---|
| **Appwrite** | Auth (sessions via `__session` cookie), user management, database (`main` DB with `files`, `folders`, `file_shares`, `releases` tables via `TablesDB`) |
| **Cloudflare R2** | File storage via AWS S3 SDK; supports direct upload and multipart upload |
| **UniSource** | External file/release management SDK (`@unisource/sdk`); accessed via `createUserUnisourceClient` (JWT) or `createAdminUnisourceClient` (API key) |
| **Upstash Redis** | Rate limiting via `@upstash/ratelimit` |

### Environment variables

Env is validated at startup with Zod in `src/lib/server/env.ts`. In production (Cloudflare Workers), secrets come from `event.platform.env`; locally they come from `.env` via `$env/dynamic/private`. The `requireRuntimeEnv(event, key)` helper merges both sources.

Required secrets: `APPWRITE_API_KEY`, `UNISOURCE_URL`, `UNISOURCE_SERVICE_ID`, `UNISOURCE_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `PUBLIC_APPWRITE_ENDPOINT`, `PUBLIC_APPWRITE_PROJECT_ID`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

### Key server modules

- `src/lib/server/appwrite.ts` — `createAdminClient()` / `createSessionClient(event)` factories
- `src/lib/server/unisource.ts` — UniSource client factories
- `src/lib/server/roles.ts` — user roles (`basic` / `plus` / `admin`), storage limits, quota checks
- `src/lib/server/cache/index.ts` — in-memory LRU cache (500 entries, 5 min TTL); keys in `cache/keys.ts`
- `src/lib/server/rate-limit.ts` — three limiters: standard (30/min), strict (10/min), upload (100/min)
- `src/lib/clients/r2.ts` — singleton `R2` S3Client

### Upload flow

Two upload destinations exist (selectable in admin settings):
- **R2 multipart**: `POST /api/upload/r2/multipart/create` → sign parts → complete/abort
- **Appwrite**: `POST /api/upload/appwrite/init`

Upload endpoints bypass the standard rate limiter and use `uploadRatelimit` instead (see recent commit for hot-path bypass).

### User roles & storage

Roles are Appwrite user labels: `admin` > `plus` > `basic`. Storage limits: basic 5 GB, plus 10 GB, admin unlimited. Per-user overrides stored in Appwrite user preferences (`prefs.storageLimit`).

### Testing

Vitest has two projects configured in `vite.config.ts`:
- **server**: node environment, matches `src/**/*.{test,spec}.{js,ts}` (excludes `.svelte.spec`)
- **client**: browser (Playwright/Chromium headless), matches `src/**/*.svelte.{test,spec}.{js,ts}`

Server tests mock `$env/dynamic/private` and service clients with `vi.mock`.

### UniSource integration

This app is tightly coupled with the **UniSource** platform:

- **Backend API** (`A:\Projects\UniSource\apps\backend`) — the server this app calls for file/release operations
- **SDK** (`A:\Projects\UniSource\packages\unisource-sdk`) — published as `@unisource/sdk`; consumed here via `createUserUnisourceClient` / `createAdminUnisourceClient`

When debugging UniSource-related behaviour, check both repos. `pnpm sdk:link` symlinks the local SDK build; `pnpm sdk:unlink` restores the published version.
