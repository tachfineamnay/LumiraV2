FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

# 1. Prune
FROM base AS pruner
# Install turbo globally for the pruning step
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=api --docker

# 2. Build
FROM base AS builder
# Install native deps
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copy lockfile and package.jsons from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies (frozen lockfile to respect pnpm-lock.yaml)
RUN pnpm install --frozen-lockfile --production=false

# Copy source code
COPY --from=pruner /app/out/full/ .

# Generate Prisma Client (Explicitly)
RUN pnpm turbo run db:generate --filter=@packages/database

# Build all packages and API
RUN pnpm turbo run build --filter=api...

# 3. Production Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files for runner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy built @packages/database (required at runtime)
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

# Copy Prisma assets needed by runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

