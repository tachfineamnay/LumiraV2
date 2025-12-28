FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

# 1. Prune
FROM base AS pruner
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=api --docker

# 2. Build
FROM base AS builder
# Install native deps needed for compilation
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copy lockfile and package.jsons from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install ALL dependencies (including dev)
RUN pnpm install --frozen-lockfile --production=false

# Copy source code
COPY --from=pruner /app/out/full/ .

# Generate Prisma Client (Explicitly)
RUN pnpm turbo run db:generate --filter=@packages/database

# Build the API
RUN pnpm turbo run build --filter=api...

# 3. Production Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy files needed for install
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install only production dependencies
# Using --ignore-scripts as requested (Note: this might skip native builds like bcrypt, but respecting prompt)
# Keeping build tools just in case pnpm needs them for linking
RUN apk add --no-cache python3 make g++ \
    && pnpm install --prod --frozen-lockfile --ignore-scripts \
    && apk del python3 make g++

# CRITIQUE : Copie du dossier dist de l'API
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# CRITIQUE : Copie des moteurs Prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built @packages/database (Ensuring workspace dependency is present)
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
