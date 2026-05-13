## Chmura Blokserwis

# UniSource SDK

Cloudflare Workers builds install dependencies with `pnpm install --frozen-lockfile`, so
`@unisource/sdk` must stay pinned to the npm package in `package.json` and `pnpm-lock.yaml`.

For local SDK development, link the neighboring checkout only in `node_modules`:

```bash
pnpm sdk:link
pnpm sdk:dev
```

Before validating the same dependency graph that Cloudflare will use, switch back to npm:

```bash
pnpm sdk:unlink
pnpm run build
```

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
