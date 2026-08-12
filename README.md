## Chmura Blokserwis

# UniSource SDK

Cloudflare Workers builds install dependencies with `pnpm install --frozen-lockfile`, so
`@unisource/sdk` must stay pinned to the npm package in `package.json` and `pnpm-lock.yaml`.

The neighboring `A:\Projects\UniSource` checkout is read-only reference material. Do not link it
into this application or publish the SDK from this repository.

# UniSource V2 beta

Stable production and the V2 beta are separate Cloudflare Workers:

- stable: `chmura-blokserwis` at `https://chmura.blokserwis.pl`
- beta: `chmura-blokserwis-beta` at `https://beta.chmura.blokserwis.pl`

Validate and dry-run beta without touching stable:

```powershell
pnpm check:beta-config
pnpm deploy:beta:dry
```

See `docs/runbooks/unisource-v2-beta.md` for infrastructure, deployment and rollback steps.

# Database init

```bash
pnpm db:init
```

# Cloudflare CORS

```json
[
	{
		"AllowedOrigins": ["https://yourdomain.com", "http://localhost:5173"],
		"AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
		"AllowedHeaders": [
			"Authorization",
			"x-amz-date",
			"x-amz-content-sha256",
			"content-type",
			"content-length",
			"x-amz-meta-originalname",
			"x-amz-meta-ownerid",
			"x-amz-meta-bucketid"
		],
		"ExposeHeaders": ["ETag", "Location", "x-amz-meta-originalname", "x-amz-meta-ownerid"],
		"MaxAgeSeconds": 3000
	},
	{
		"AllowedOrigins": ["*"],
		"AllowedMethods": ["GET"],
		"MaxAgeSeconds": 3000
	}
]
```
