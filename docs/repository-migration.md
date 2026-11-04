# Frontend repository migration

## Imported source and preserved history

- Target repository: `Dan1el-19/chmura-blokserwis`, based on commit
  `44a5bcfaa1a160d66affe0208e75aa835fcdf317`.
- Source repository: `Dan1el-19/unisource-cloud`, commit
  `fb043d0` (tracked files only).
- The migration is a normal descendant commit. Existing target history and tags
  are preserved; no force push or repository recreation is required.
- Local, uncommitted edits in either source checkout are excluded.
- `AGENTS.md` from the target repository is preserved.

## CI and production cutover

1. Run the imported CI on the migration PR: typecheck, lint, unit/component tests,
   browser navigation tests, protobuf snapshot validation and production build.
2. Inspect the current `unisource-cloud` Worker Builds connection and record its
   configuration before changing it. Keep the Worker name, domain, Clerk key,
   API address and disabled workers.dev/preview URLs from `wrangler.jsonc`.
3. Merge the migration PR after CI passes. Then disconnect automatic builds from `Dan1el-19/unisource-cloud`. Connect the same
   Worker to `Dan1el-19/chmura-blokserwis`, production branch `main`, root `/`,
   build `pnpm run build`, deploy `npx wrangler deploy`, paths `*`. Disable
   non-production branch deployments. Do not trigger a build of the legacy
   target `main` while the migration PR is still unmerged.
4. Run/verify a production build of the exact merged commit from `chmura-blokserwis`. A changed
   connection alone does not prove a deployment occurred.
5. Verify `https://chmura.blokserwis.pl`, Clerk sign-in, private/shared catalog,
   upload/download, previews and public links. A successful build or HTTP 200
   alone does not establish authenticated transfer acceptance.
6. Keep `unisource-cloud` as a historical source until the cutover is verified.
   Older target branches still contain their original workflow files; do not
   run their legacy deploy or release workflows against production.

GitHub Actions runs validation only. The former stable/beta Appwrite workflows
and semantic release workflow are intentionally absent from the new tree.
No existing cloud data or backend resources are migrated by this change.

## Deployment rollback

Use the existing Worker's deployment history to restore a previously verified
version if runtime acceptance fails. Reverting the migration commit restores
legacy workflow files too, so a Git revert is not a deployment rollback plan.

## Verified migration status — 2026-11-04

The repository replacement was merged in PR #3 as `c956869`. The existing
`unisource-cloud` Worker is connected to `chmura-blokserwis/main`; source-repo
production triggers and the legacy Worker's Builds triggers have been removed.
Workers Previews are disabled. Commit `cf030e7` subsequently passed CI and was
successfully deployed from the target repository on 2026-11-03.

The local target checkout has been updated. The merged migration worktree and
its local/remote branch were removed after verifying ancestry. Unfinished legacy
quotation changes and audits are preserved as `66d806f` on
`codex/preserve-legacy-local-work-2026-11-04`; the unmerged
`codex/opencloud-evaluation` branch is also retained.

On 2026-11-04 the user confirmed the requested authenticated production test
scope. The source repository was given a migration notice and archived with
its history and tags preserved; its obsolete CI was disabled. The unused
legacy Worker `chmura-blokserwis` was removed after dependency, scheduling and
traffic checks. The active `unisource-cloud` Worker and production domain remain
in use. See the [cleanup report](environment-cleanup.md) for the evidence and
recovery inputs.

The local source checkout is still retained because existing Codex chats and
tool processes depend on its path and the app requires source-folder consent
for moving those chats. This is the remaining local retirement gate.

## Production Worker name — 2026-11-05

After migration and retirement, the user requested the production Worker name
`chmura-blokserwis`. The active `unisource-cloud` Worker was renamed in place,
preserving ID `1103ffc1eb1849d39269e130963830fa`, its history and domain. This
supersedes references to the active `unisource-cloud` name in the historical
migration steps above. The legacy service deleted on 2026-11-04 was a different
Worker. Current deployment configuration is in `wrangler.jsonc`.
