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
