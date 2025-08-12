# Multi stage Dockerfile for Next.js 15 (React 19) app
# Uses standalone output to minimize runtime image size
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies using the existing lockfile
COPY package.json package-lock.json* ./
RUN npm ci


FROM node:20-alpine AS builder
WORKDIR /app

# Copy installed node_modules from deps stage for faster builds
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the app source
COPY . .

# Ensure `public` directory exists even if empty in repo, so later COPY won't fail
RUN mkdir -p public

# Public envs needed at build time (injected from Cloud Build as --build-arg)
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG R2_PUBLIC_HOSTNAME

# Expose them to the build so Next.js can inline them into the client bundle
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    R2_PUBLIC_HOSTNAME=$R2_PUBLIC_HOSTNAME

# Build the Next.js app (standalone output configured in next.config.ts)
RUN npm run build


FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy public assets
COPY --from=builder /app/public ./public

# Copy the standalone server and required files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Next.js standalone output expects the same working directory structure
# The server entrypoint is server.js produced by Next

# Expose the port used by Next.js server
EXPOSE 3000
ENV PORT=3000

# For Cloud Run, the service will listen on $PORT
CMD ["node", "server.js"]


