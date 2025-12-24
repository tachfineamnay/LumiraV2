# Base stage for shared setup
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

# Build stage
FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile --production=false
RUN pnpm --filter @packages/database db:generate
RUN pnpm --filter web build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
ENV PORT 3000

# Copy necessary files for Next.js standalone (if configured) or just use pnpm start
# For simplicity in this setup, we'll keep the full node_modules but pruned
COPY --from=builder /app ./

# Expose port
EXPOSE 3000

# Run the web app
CMD ["pnpm", "--filter", "web", "start"]
