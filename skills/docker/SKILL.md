---
name: Docker & DevOps
description: Guidelines for Docker containerization, Docker Compose, and infrastructure.
---

# Docker & DevOps Skills

## Context

The project is fully containerized using **Docker** and orchestrated with **Docker Compose**.
It follows a **Multi-Stage Build** pattern to minimize image size.

## Architecture

- **Web**: Next.js Standalone build.
- **API**: NestJS build.
- **Postgres**: Standard Alpine image.
- **Gotenberg**: Dedicated PDF generation service.

## Usage Instructions

### 1. Docker Compose

The `docker-compose.yml` is located in `docker/`.

```bash
# Start all services
docker-compose up -d

# Rebuild specific service
docker-compose up -d --build api
```

### 2. Dockerfiles

Located in `apps/web/Dockerfile` and `apps/api/Dockerfile`.
**Crucial**: They use `turbo prune` to Isolate dependencies for the specific app before building.

### 3. Environment Variables

- `.env` at root is used by Docker Compose.
- **Check** `DATABASE_URL` matches the service name in docker-compose (e.g., `postgres` host).

## Troubleshooting

- **Gotenberg Issues**: If PDF generation fails, check Gotenberg logs (`docker logs lumira-v2-gotenberg-1`). It often requires significant RAM.
- **Prisma Client**: If you get "Prisma Client not initialized", ensure `pnpm db:generate` ran during the build stage.
