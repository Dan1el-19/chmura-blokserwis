## Chmura Blokserwis

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
