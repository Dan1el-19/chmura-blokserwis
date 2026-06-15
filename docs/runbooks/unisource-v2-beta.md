# UniSource V2 beta

Beta runs as a separate Cloudflare Worker next to stable production:

| Environment | Worker                   | Route                         |
| ----------- | ------------------------ | ----------------------------- |
| Stable      | `chmura-blokserwis`      | `chmura.blokserwis.pl/*`      |
| Beta        | `chmura-blokserwis-beta` | `beta.chmura.blokserwis.pl/*` |

The beta Worker uses UniSource API/SDK V2, but intentionally receives the same Appwrite, R2,
Upstash and UniSource credentials as stable. Do not create local links to the UniSource checkout.
`A:\Projects\UniSource` is read-only reference material for this repository.

## One-time infrastructure

1. Create the `beta.chmura.blokserwis.pl` DNS/custom-domain route in the same Cloudflare zone.
2. Add `https://beta.chmura.blokserwis.pl` to Appwrite allowed platforms/origins.
3. Add the beta origin to R2 CORS allowed origins.
4. Create a protected GitHub environment named `beta`.
5. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the `beta` GitHub environment.
6. Configure the beta Worker's required secrets with the same values used by stable:

```powershell
pnpm exec wrangler secret bulk .dev.vars.beta --env beta
```

Keep `.dev.vars.beta` local and never commit it.

## Local verification

```powershell
pnpm check:beta-config
pnpm check
pnpm exec vitest run --project server
pnpm deploy:beta:dry
```

`check:beta-config` fails if the beta Worker, route, secrets declaration, deploy scripts or workflow
can target stable accidentally. Never run an unscoped `wrangler deploy` for beta.

## Deployment

Push `codex/unisource-v2-beta` or manually run the `Deploy beta` workflow. The workflow:

1. refuses to run from `main`;
2. validates beta isolation;
3. runs checks and server tests;
4. confirms stable responds;
5. deploys only with `--env beta`;
6. smoke-tests beta and confirms stable still responds.

## Rollback

Rollback only the beta Worker:

```powershell
pnpm exec wrangler rollback --env beta
```

Do not change or roll back `chmura-blokserwis` while validating beta.
