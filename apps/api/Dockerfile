# Base stage for shared setup
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

# Build stage
FROM base AS builder
# Install build dependencies for native modules like bcrypt
RUN apk add --no-cache python3 make g++
COPY . .
RUN pnpm install --frozen-lockfile --production=false
RUN pnpm --filter @packages/database db:generate
RUN pnpm --filter api build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
# Re-install only production dependencies
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy build artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
