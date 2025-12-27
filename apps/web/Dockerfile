FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

# 1. Prune
FROM base AS pruner
# Install turbo globally for the pruning step
RUN npm install -g turbo
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

# Generate Prisma Client (Explicitly)
RUN pnpm turbo run db:generate --filter=@packages/database

# Build Web
RUN pnpm turbo run build --filter=web...

# 3. Production Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Optimization: Don't install dependencies in runner.
# Use Next.js standalone output which includes necessary node_modules.

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets (required for UI to look right)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
