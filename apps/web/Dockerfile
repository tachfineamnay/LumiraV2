FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

# 1. Prune
FROM base AS pruner
# Install turbo globally for the pruning step
RUN npm install -g turbo@2.7.1
COPY . .
RUN turbo prune --scope=web --docker

# 2. Build
FROM base AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copy lockfile and package.jsons from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies
RUN pnpm install --frozen-lockfile --production=false

# Copy source code
# Copy source code
COPY --from=pruner /app/out/full/ .

# NEXT_PUBLIC_* values are compiled into browser bundles; API_INTERNAL_URL is
# used by server-side routes and rewrites inside the Docker network.
# Default API URL unblocks Coolify when the var is missing or passed empty
# as a build-arg (empty overrides a plain ARG default). Override via Coolify
# "Build Variable" when targeting a non-production API.
ARG NEXT_PUBLIC_API_URL=https://api.oraclelumira.com
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG API_INTERNAL_URL=http://api:3001

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://api.oraclelumira.com}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID
ENV API_INTERNAL_URL=${API_INTERNAL_URL:-http://api:3001}

RUN if [ -z "$NEXT_PUBLIC_API_URL" ] || [ -z "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" ]; then \
      echo "========================================================================="; \
      if [ -z "$NEXT_PUBLIC_API_URL" ]; then echo "ERROR: NEXT_PUBLIC_API_URL is empty"; fi; \
      if [ -z "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" ]; then echo "ERROR: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is empty"; fi; \
      echo "Next.js inlines NEXT_PUBLIC_* into the client bundle at BUILD TIME."; \
      echo ""; \
      echo "In Coolify (Web / Desk services):"; \
      echo "1. Environment Variables → set each missing variable."; \
      echo "2. Enable 'Build Variable' / 'Available at build time'."; \
      echo "3. Save and redeploy."; \
      echo "========================================================================="; \
      exit 1; \
    fi

# Generate Prisma Client (Explicitly)
RUN pnpm turbo run db:generate --filter=@packages/database

# Ensure public directory exists (even if empty) to avoid COPY errors
RUN mkdir -p /app/apps/web/public

# Build Web
RUN pnpm turbo run build --filter=web...

# Verify build outputs exist
RUN ls -la /app/apps/web/.next/ && \
    ls -la /app/apps/web/.next/standalone/ || echo "Standalone directory not found" && \
    ls -la /app/apps/web/.next/static/ || echo "Static directory not found" && \
    ls -la /app/apps/web/public/ || echo "Public directory not found"

# 3. Production Runner
FROM base AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Optimization: Don't install dependencies in runner.
# Use Next.js standalone output which includes necessary node_modules.

# Copy standalone build (with conditional check)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets (required for UI to look right)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Copy public assets (images, fonts, favicon) - using wildcard to handle empty dirs
COPY --from=builder /app/apps/web/public/ ./apps/web/public/


EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
