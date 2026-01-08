# 1. Stage Pruner
FROM node:20-alpine3.18 AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=api --docker

# 2. Stage Builder
FROM node:20-alpine3.18 AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Installation de pnpm et des dépendances
RUN npm install -g pnpm
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
# Désactiver Husky pour le build
ENV HUSKY=0 
RUN pnpm install --no-frozen-lockfile

# Copie du code source complet
COPY --from=pruner /app/out/full/ .

# Génération Prisma et Build Turbo
RUN pnpm turbo run db:generate --filter=@packages/database
RUN pnpm turbo run build --filter=api...

# 3. Stage Runner
FROM node:20-alpine3.18 AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HUSKY=0

# Installation des dépendances de prod uniquement
RUN npm install -g pnpm
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

# RÉCUPÉRATION DES ARTIFACTS (CRUCIAL)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Copie du package @packages/database buildé
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
# Copie du package @packages/shared buildé
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
# Copie du client Prisma généré
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# SCRIPT DE SEEDING
RUN npm install -g tsx
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Scripts de maintenance (seed prod, etc.) - copie depuis pruner car turbo prune n'inclut pas /scripts
COPY --from=pruner /app/scripts ./scripts

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
