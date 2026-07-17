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
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG API_INTERNAL_URL=http://api:3001

RUN if [ -z "$NEXT_PUBLIC_API_URL" ] || [ -z "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" ]; then \
      echo "========================================================================="; \
      echo "ERROR: NEXT_PUBLIC_API_URL or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is empty!"; \
      echo "Because Next.js compiles NEXT_PUBLIC_* environment variables into the client-side"; \
      echo "bundle, these variables must be provided at BUILD TIME."; \
      echo ""; \
      echo "To fix this in Coolify:"; \
      echo "1. Go to the 'Environment Variables' tab of your Web service."; \
      echo "2. Find NEXT_PUBLIC_API_URL and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."; \
      echo "3. Ensure their values are set, and check the 'Build Variable' (or 'Available at build time') toggle."; \
      echo "4. Save and redeploy."; \
      echo "========================================================================="; \
      exit 1; \
    fi

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV API_INTERNAL_URL=$API_INTERNAL_URL

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
