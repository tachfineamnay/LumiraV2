FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy all project files
COPY . .

# Enable corepack for pnpm
RUN corepack enable

# Install all dependencies (including devDeps for build)
# We use --production=false to ensure devDependencies are installed even if NODE_ENV is production
RUN pnpm install --frozen-lockfile --ignore-scripts --production=false

# Build the Web app
# Next.js will use NODE_ENV=production internally for 'next build'
RUN pnpm --filter web build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT 3000

# Run the web app
CMD ["pnpm", "--filter", "web", "start"]
