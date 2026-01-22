---
name: Backend Architecture (NestJS)
description: Guidelines for NestJS patterns, Modules, DigitalSoulService, and Factory Patterns.
---

# Backend Architecture Skills

## Context

The backend is a **NestJS 10** Monolith rooted in `apps/api`.
It uses a strictly modular architecture.

## Core Principles

1. **Dependency Injection**: All services must be injectable. No global state.
2. **Factory Pattern**: Complex object creation (like PDFs) MUST be encapsulated in Factories (e.g., `PdfFactory`).
3. **Saga Pattern**: Long-running processes (Order -> AI -> DB -> S3) are orchestrated in `DigitalSoulService`.

## Key Components

### 1. DigitalSoulService (`services/factory/DigitalSoulService.ts`)

This is the core business logic.

- **Input**: `Order` ID.
- **Process**: Orchestrates Vertex AI (`VertexOracle`), Database (`Prisma`), and Generation (`PdfFactory`).
- **Transaction**: Uses `prisma.$transaction` to ensure `SpiritualPath` and `PathStep` creation is atomic.

### 2. VertexOracle (`services/factory/VertexOracle.ts`)

Encapsulates communication with Google Vertex AI.

- Handles Prompt Engineering.
- Returns strict JSON structures (parsed via Zod or manually).

### 3. Modules

- `OrdersModule`: E-commerce logic.
- `ExpertModule`: Admin/Back-office logic.
- `InsightsModule`: AI Insights logic.

## Best Practices

- **Validation**: Use `class-validator` DTOs (Data Transfer Objects) for all Controllers.
- **Error Handling**: Throw standard NestJS exceptions (`NotFoundException`, `BadRequestException`).
- **Logging**: Use `Logger` service, not `console.log`.
