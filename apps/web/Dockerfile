FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy all project files
COPY . .

# Enable corepack for pnpm
RUN corepack enable

# Force development environment for build to ensure all dependencies are resolved
ENV NODE_ENV=development

# Install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile --ignore-scripts --production=false

# Build the Web app
# Ensure public and static files are handled by the framework output
RUN pnpm --filter web build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT 3000

# Next.js standalone output is handled if configured, otherwise run from source/dist
# If output: 'standalone' is not enabled, use:
CMD ["pnpm", "--filter", "web", "start"]
