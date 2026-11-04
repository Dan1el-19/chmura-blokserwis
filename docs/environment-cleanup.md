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
  these are retained pending legacy-service retirement, not used by current CI
  or Workers Builds. Their values were not read or copied.

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

## Remaining gates

1. Sign in to the production frontend using an account authorized for testing.
   Verify the private/shared catalog, a small upload and checksum-verified
   download, preview, public link and revocation. Remove the test data.
   The available browser currently shows the Clerk sign-in form.
2. Move source-project chats to the canonical Codex project through the app's
   consent flow. The app tool returned `confirmation_required` because the
   destination project does not include `/Users/daniel/Projects/unisource-cloud`.
   Current and historical chats still depend on that source path; do not delete
   it or terminate their tool processes to work around this requirement.
3. After acceptance, add a migration notice to the source repository and archive
   `Dan1el-19/unisource-cloud`, preserving its history and tags. Then remove the
   obsolete source checkout after resolving all chat/tool path references.
4. Before deleting the old Worker `chmura-blokserwis`, establish that no custom
   domains, routes, traffic or other consumers depend on it and identify the
   necessary recovery configuration. The read-only API inventory found no
   custom domains, disabled workers.dev/previews, no routes across four account
   zones, and no incoming service bindings among nine account Workers. The old
   script still carries legacy secret bindings; their values were not read.
   Traffic acceptance and recoverability are still open, so the service and its
   secrets remain available. An empty Builds trigger list alone is insufficient
   evidence for deletion.

Production resources, backend storage and authentication configuration have not
been removed by this cleanup. No scheduled automations referencing either
frontend repository were found in the local automation configuration inventory.
