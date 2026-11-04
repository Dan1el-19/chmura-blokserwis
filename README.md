# Chmura Blokserwis

SvelteKit frontend for the UniSourceCFL file API. UniSourceCFL remains the
backend name; the product shown to users is Chmura Blokserwis.

## Local development

1. Copy `.env.example` to `.env` and set a Clerk development publishable key.
2. Start the UniSourceCFL Worker on `http://localhost:8787` with its local D1
   migrations applied.
3. Run `pnpm dev`; Vite serves the app at `http://localhost:3000`, the exact
   development origin allowed by the Worker and R2.

The browser obtains a production Clerk session token and sends it as
`Authorization: Bearer ...` to the ConnectRPC API. For local development use
the development Clerk instance consistently in both projects.

New uploads use the controlled target URL and headers returned by the API:
R2 receives bytes through the backend Worker and RustFS through the upload
gateway. Downloads use signed URLs for the file's recorded storage location.

## Supported backend features

- Private files at `/`, shared files at `/main`, and private/shared trash at
  `/trash`; folder navigation, creation, renaming, moving, download, restore,
  and permanent deletion.
- Sort by name, creation date, or size, with stable pagination. Folder sizes
  include active files in their active descendants.
- Preview supported images, audio, and video through short-lived signed reads.
- Create multiple independent public links per file at `/s/<token-or-slug>`;
  each link can expire or be revoked separately.
- Upload modes Auto (default), R2, and RustFS. Auto asks the backend to choose
  a location and permits at most one fallback for eligible transport/server
  failures. Manual transfers keep the selected location.
- Worker-based checksum preparation with progress and cancellation, green success
  statuses that clear after five seconds, and a persistent transfer navigation shortcut.
- Attempt-aware completion, recovery after a lost completion response,
  progress, cancellation, and the actual storage location in status and lists.
- The backend's upload limit, capped by the 100 MB technical limit, checked
  before sending bytes. A zero-byte limit permits empty files only.
- A session-wide transfer queue and collapsible progress panel, preserved across
  Files/Main/Trash/Settings navigation. Each batch keeps its original destination
  and mode; files can be added while another transfer runs.
- Folder/trash lists cached for 15 minutes, pagination and scroll position, with background
  refresh instead of restarting the screen on each operation.
- Personal upload preferences at `/settings`, saved per account in this browser,
  below Trash in the sidebar/drawer; upload configuration stays out of file views.
- Administrative storage limits at `/settings`, gated by backend permissions
  and protected by the settings revision. Ordinary accounts can read their
  upload limit without access to administrative settings.

Uploads remain in memory while the tab is alive; reload/close does not resume
file bytes. See [frontend state and navigation](docs/frontend-state.md) for lifecycle
and cache rules.

Existing administrative cloud settings remain available at `/settings`.
There are no per-user storage limits or account tiers. The frontend contains
the public Clerk publishable key; no Clerk secret or backend credential is
stored here.

## Cloudflare deployment

The app serves `https://chmura.blokserwis.pl`, uses the API at
`https://api.blokserwis.pl`, and sends storage transfers to
`https://s3.blokserwis.pl`. Clerk remains the existing UniSource ID application
on `auth.blokserwis.pl`. The legacy `cloud.blokserwis.pl` and workers.dev app
URLs are disabled as part of the cutover.

## Automatic deployment from GitHub

The production Worker is named `chmura-blokserwis`. It was renamed from
`unisource-cloud` on 2026-11-05, keeping its Worker ID and deployment history.
Cloudflare Workers Builds is connected to `Dan1el-19/chmura-blokserwis`, production
branch `main`. The former `Dan1el-19/unisource-cloud` repository no longer triggers
production deployments. Production uses these settings:

| Setting | Value |
| --- | --- |
| Root directory | `/` |
| Build command | `pnpm run build` |
| Deploy command | `npx wrangler deploy` |
| Package manager | `pnpm@12.14.0` from `package.json` |
| Build paths | `*`, without exclusions |

Cloudflare installs dependencies, builds the SvelteKit application into
`.svelte-kit/cloudflare`, then deploys the Worker and its static assets using
`wrangler.jsonc`. The build and deployment are separate steps; the deploy
command must not rebuild the application.

A new push to `main` triggers deployment. Connecting a repository after an
existing commit does not provide evidence that this commit has been built;
check the Worker's Builds history for the exact Git SHA and a successful
production deployment. GitHub Actions runs quality checks separately and does
not deploy the Worker.

Automatic non-main branch deployments and Workers Previews are disabled. The
reserved `previews` settings in `wrangler.jsonc` use a development Clerk key and
an `.invalid` API hostname; they do not represent an active preview environment.

See the [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
and [build image/package manager selection](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).

## API snapshot

`proto/` is a pinned snapshot of the backend's public protobuf contract, not a
shared workspace or monorepo. Its source revision is recorded in
[`proto/SNAPSHOT.md`](proto/SNAPSHOT.md). Install Buf CLI 1.75.0 and run
`pnpm proto:generate` after deliberately updating the snapshot from
UniSourceCFL. Generated descriptors are checked in under `src/lib/gen`.

Run `pnpm proto:check:backend /absolute/path/to/UniSourceCFL` with the intended
backend revision checked out before publishing a synchronized update. It
compares all `.proto` paths and contents, including added and removed files,
then verifies the generated client. Normal `pnpm proto:check` also verifies
generation in a temporary directory without modifying checked-in files.
CI checks local generation; it does not fetch the other private repository
or claim automatic detection of later backend changes.

## Commands

- `pnpm check` validates Svelte/TypeScript.
- `pnpm lint` checks style and common errors.
- `pnpm test` runs unit and Chromium component tests. On a fresh machine,
  first run `pnpm exec playwright install chromium`; CI installs Chromium
  and its Linux system dependencies with `--with-deps`.
- `pnpm test:e2e` runs actual application navigation in Chromium, Firefox and
  mobile Chromium with controlled external-service fixtures. Install browsers with
  `pnpm exec playwright install chromium firefox` first. Use
  `pnpm test:e2e --project=chromium --project=mobile` for a Chromium-only run.
- `pnpm proto:check` validates the pinned Proto files and generated client.
- `pnpm proto:check:backend /path/to/UniSourceCFL` checks the snapshot against
  a backend checkout and verifies the generated client.
- `pnpm build` creates the Cloudflare Workers build.

## Repository migration

The application files were imported from `Dan1el-19/unisource-cloud` at commit
`fb043d0` onto the existing `chmura-blokserwis` history. Earlier commits and tags
remain available. The old Appwrite stable/beta deployment workflows and semantic
release workflow are replaced by the current frontend CI. Production continues
to use Workers Builds; GitHub Actions does not need Cloudflare or backend secrets.
See [migration checklist](docs/repository-migration.md) for the cutover checks.

## Active local checkout

Use `/Users/daniel/Projects/chmura-blokserwis` and the matching Codex project for
new frontend work. See the [environment cleanup report](docs/environment-cleanup.md)
for preserved legacy work and the remaining retirement gates. Historical
quotation code and OpenCloud evaluations are kept on their own branches and
are not part of the active frontend.
