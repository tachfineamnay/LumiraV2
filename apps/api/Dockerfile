FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy all project files
COPY . .

# Enable corepack for pnpm
RUN corepack enable

# Install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile --ignore-scripts --production=false

# Generate Prisma client
RUN pnpm --filter @packages/database db:generate

# Build the API
RUN pnpm --filter api build

# Cleanup node_modules (optional but recommended for production)
# RUN pnpm install --prod --frozen-lockfile --ignore-scripts

ENV NODE_ENV=production
EXPOSE 3001

# Run from the api directory or adjust paths
CMD ["node", "apps/api/dist/main.js"]
