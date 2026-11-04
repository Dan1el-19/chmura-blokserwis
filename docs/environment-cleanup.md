# Environment cleanup — 2026-11-04

## Canonical environment

- Repository: `Dan1el-19/chmura-blokserwis`, production branch `main`.
- Local checkout: `/Users/daniel/Projects/chmura-blokserwis`.
- Codex project: `chmura-blokserwis` (already registered).
- Production Worker: `unisource-cloud`; domain: `chmura.blokserwis.pl`.
- GitHub Actions validates code; Workers Builds deploys `main`.
- Preview deployments are disabled. No Deploy Hooks are configured for either
  frontend Worker. Neither repository has repository-level Actions secrets,
  variables or repository webhooks at the time of inspection. The target still
  has legacy environment-level deployment secrets in `beta` and `production`;
  these are retained as inputs for rebuilding the historical application, not
  used by current CI or Workers Builds. Their values were not read or copied,
  and shared credentials were not revoked.

## Preserved history and local work

The original target main is still an ancestor of the current main. All five
unfinished files were preserved in commit `66d806fd3dc1937c783baa64f83911f098a498d0`
and pushed to `codex/preserve-legacy-local-work-2026-11-04`:

- `src/routes/wyceny/nowa/+page.svelte` and its new `page.svelte.spec.ts`;
- the OpenCloud, Reva and Appwrite-exit audits formerly in `docs/audits/`.

These files were preserved, not validated or restored as product features.
`codex/opencloud-evaluation` contains the separate historical commit `e5ae75b`
and remains intact. There is no PR to merge either historical branch.

The merged `codex/replace-with-unisource-cloud` branch was removed locally and
remotely, together with its clean worktree at
`/Users/daniel/.codex/worktrees/chmura-repo-migration`. Migration execution records
were retained outside that worktree in the local cleanup task directory.

No unique ignored files were found outside dependency/build/cache directories.
No existing `.env` or `.dev.vars` file required copying. An ignored local `.env`
was created from `.env.example`, using the Clerk development key and localhost
API address. The local backend is not started by this cleanup. Existing
production defaults must not be mistaken for a configured local backend.

## Verification

The updated canonical checkout passed `pnpm install --frozen-lockfile`,
`pnpm check` (zero errors/warnings), `pnpm lint`, `pnpm proto:check` and
`pnpm build`. These checks validate local setup, not authenticated production
transfers. The dev server returned HTTP 200 on `127.0.0.1:3105` with a development
Clerk key and `http://localhost:8787` API. Its first request had an SSR lifecycle
error after the checkout replacement; clearing generated SvelteKit/Vite caches
and restarting the server resolved it without changing application code. The
first request after cache regeneration exceeded a 30-second client timeout; a
subsequent request completed successfully. The temporary dev server was stopped. The latest production commit inspected before this documentation
change was `cf030e7`, with successful CI and Workers Builds.

## Production acceptance and remote retirement

On 2026-11-04 the user confirmed that the complete requested production scope
works: sign-in, private/shared catalogs, upload/download, previews, public links
and revocation. This is user-reported acceptance; the cleanup agent did not
perform new authenticated production transfers or claim an independent checksum
comparison.

`Dan1el-19/unisource-cloud` was archived after a migration notice linking to
`Dan1el-19/chmura-blokserwis` was committed as `b077826`. Its obsolete CI workflow
was disabled before that notice was pushed. No open PR/issues or active runs
were found. Application parity was checked before archival, and remote tag refs
and the existing source ancestry were verified unchanged afterward.

The old Worker `chmura-blokserwis` was deleted with Wrangler, without `--force`,
after these checks:

- no custom domains, disabled workers.dev and previews;
- no routes across all four account zones;
- no incoming service bindings among all nine account Workers;
- no cron schedules and no Builds triggers or Deploy Hooks;
- no recorded invocations between 2026-11-01 20:07 UTC and 2026-11-04 11:55 UTC;
  the same Analytics query returned traffic for production as a positive control;
- the script had static assets and legacy secret/configuration bindings, with no
  database, bucket or Durable Object binding to delete.

The last deployed legacy version was `13874d8f-5ffd-4dd2-90f7-c3f03be11951`.
Recovery means rebuilding the historical source at `44a5bcf` using retained
GitHub environment secrets, not restoring the deleted Worker's deployment
history. The historical Wrangler config and deployment metadata were recorded
in the local cleanup task directory. A recovery config must remove the old
production route and keep public routing disabled before recreating an isolated
legacy service; the historical config must not be deployed unchanged over the
current domain.

After deletion, the old script was absent from the Worker inventory, the active
`unisource-cloud` Worker still followed `chmura-blokserwis/main`, and production
returned HTTP 200. Current backend storage, authentication and shared tokens
were not removed or revoked.

## Remaining local gate

Source-project chats still need to be moved to the canonical Codex project
through the app's consent flow. The app tool returned `confirmation_required`
because the destination project does not include
`/Users/daniel/Projects/unisource-cloud`. Current and historical chats and tool
processes still depend on that source path. Keep the local source directory
until those references are resolved; do not terminate the chat's tools to work
around the source-access requirement. After archival, its ignored `node_modules`
and `.svelte-kit` outputs were removed after verifying that neither contained
tracked files. The source directory shrank from approximately 821 MB to 3.4 MB;
source code, Git history and task records remain available.

No scheduled automations referencing either frontend repository were found in
the local automation configuration inventory.
