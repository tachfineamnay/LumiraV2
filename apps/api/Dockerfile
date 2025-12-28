# 1. Stage Pruner
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=api --docker

# 2. Stage Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Installation de pnpm et des dépendances
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
# Désactiver Husky pour le build
ENV HUSKY=0 
RUN pnpm install --frozen-lockfile

# Copie du code source complet
COPY --from=pruner /app/out/full/ .

# Génération Prisma et Build Turbo
RUN pnpm turbo run db:generate --filter=@packages/database
RUN pnpm turbo run build --filter=api...

# 3. Stage Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HUSKY=0

# Installation des dépendances de prod uniquement
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

# RÉCUPÉRATION DES ARTIFACTS (CRUCIAL)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Copie du client Prisma généré
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
