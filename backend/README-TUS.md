# TUS server (Node) — backend/tus-server.mjs

This document explains how to run the included Node-based TUS server (`tus-server.mjs`) which implements a TUS resumable upload endpoint backed by an S3-compatible store (Cloudflare R2).

Files added:
- `tus-server.mjs` — Node HTTP server that mounts `@tus/server` on `/files` and uses `@tus/s3-store`.
- `Dockerfile` — minimal container to run the server.
- `.env.example` — example environment variables.

Required environment variables
- `R2_BUCKET` (or `R2_BUCKET_NAME`): the R2 bucket name
- `R2_ENDPOINT`: the S3-compatible endpoint URL (optional; the server has a default but you should set yours)
- `ACCESS_KEY_ID`: R2 access key
- `SECRET_ACCESS_KEY`: R2 secret
- `TUS_PORT` (optional): TCP port to listen on (default: 1080)

Run locally (PowerShell)

```powershell
$env:R2_BUCKET='your-bucket'
$env:R2_ENDPOINT='https://<account>.r2.cloudflarestorage.com'
$env:ACCESS_KEY_ID='AKIA...'
$env:SECRET_ACCESS_KEY='...'
node tus-server.mjs
```

Run with npm script

If you prefer, use the existing npm script in `package.json`:

```powershell
$env:R2_BUCKET='your-bucket'; $env:ACCESS_KEY_ID='...'; $env:SECRET_ACCESS_KEY='...'; npm run start-tus
```

Docker

Build:

```powershell
docker build -t tus-server:latest .
```

Run (example):

```powershell
docker run -e R2_BUCKET=your-bucket -e ACCESS_KEY_ID=... -e SECRET_ACCESS_KEY=... -p 1080:1080 tus-server:latest
```

Deploy notes
- For Cloud Run / ECS / other container platforms, set env vars through the platform, expose port `1080` and use the Dockerfile.
- Ensure the service can reach the R2 endpoint (network egress) and the credentials have R2 permissions.

Cloud Run / CI notes
- A sample GitHub Actions workflow has been added at `.github/workflows/deploy-cloudrun.yml`.
- Required GitHub secrets:
	- `GCP_SA_KEY` — JSON service account key for a GCP service account with Cloud Run deploy and Cloud Build permissions.
	- `GCP_PROJECT` — your GCP project id.
	- `GCP_REGION` — region for Cloud Run (e.g., `us-central1`).

Before using the workflow, replace `gcr.io/YOUR_PROJECT_ID/tus-server:latest` in `cloudrun.yaml` with your image path or configure the workflow secrets.

Next steps
- Add monitoring / logging as needed.
- If you want an HTTPS endpoint and public hosting, deploy the container to Cloud Run or a VPS and put a proxy in front.

Local docker-compose

```powershell
docker-compose up --build
```

This uses `.env.local` for environment variables.

GCP Secret Manager (optional)

There's a helper script `gcp-create-secret.sh` which will create/update a secret in GCP Secret Manager. Usage:

```bash
./gcp-create-secret.sh <GCP_PROJECT_ID> [SECRET_NAME]
# set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY as env vars before running the script

export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
./gcp-create-secret.sh my-gcp-project r2-credentials
```

The script will store a JSON payload with `accessKeyId` and `secretAccessKey` in Secret Manager. You can then reference that secret in Cloud Run or convert into separate secrets as needed.
