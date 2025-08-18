Production deployment notes

This repository contains a Next.js frontend and a Node-based TUS server for resumable uploads.

Quick checklist to prepare production:

1) Environment
- Provide the following env vars for the TUS server (backend/.env.local or via your platform):
  - CLOUDFLARE_R2_BUCKET_NAME (or R2_BUCKET/R2_BUCKET_NAME)
  - CLOUDFLARE_R2_ENDPOINT (or R2_ENDPOINT)
  - CLOUDFLARE_R2_ACCESS_KEY_ID
  - CLOUDFLARE_R2_SECRET_ACCESS_KEY
  - TUS_PORT (optional, default 1080)
  - ALLOWED_ORIGINS (comma-separated origins for CORS, default http://localhost:3000)

- Provide the following frontend env vars at build time (Next.js):
  - NEXT_PUBLIC_FIREBASE_API_KEY
  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  - NEXT_PUBLIC_FIREBASE_APP_ID
  - NEXT_PUBLIC_TUS_ENDPOINT (e.g. https://tus.example.com/files/)

2) Build and run
- Frontend (Next.js standalone build):
  - docker build -t chmura-frontend:latest -f frontend/Dockerfile frontend/
  - docker run -e NEXT_PUBLIC_TUS_ENDPOINT="https://tus.example.com/files/" -p 3000:3000 chmura-frontend:latest

- Backend (TUS):
  - docker build -t tus-server:latest backend/
  - docker run --env-file backend/.env.local -p 1080:1080 tus-server:latest

3) Recommendations
- Run TUS behind an HTTPS reverse proxy (NGINX, Cloud Run, Cloud Run service) and terminate TLS there. Ensure to forward the original Host header.
- Use healthchecks (GET /health) to monitor server readiness.
- Set ALLOWED_ORIGINS to your production origin(s) to restrict CORS.
- Consider running backend with non-root user in Docker for security.

4) Kubernetes / Cloud Run
- The Dockerfiles are prepared for production. For Cloud Run, use the frontend/ Dockerfile runner stage and pass build args for NEXT_PUBLIC_*.

If you want I can:
- Add a small systemd unit file template or Kubernetes manifest for both services.
- Add a Health probe endpoint for frontend (if needed).
