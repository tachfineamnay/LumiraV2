# Lumira V2 - AI Agent Instructions

## 1. Project Context & Architecture

**Monorepo Strategy (Turborepo + pnpm)**
- **Apps**: `apps/web` (Next.js 14 App Router), `apps/api` (NestJS 10).
- **Packages**: `@packages/database` (Prisma), `@packages/ui` (Shared React components), `@packages/shared` (Types/Utils).
- **Workspace Boundaries**: Strict separation. NEVER import relatively across apps/packages (e.g., `../../packages`). ALWAYS use workspace aliases (`@packages/*`).

**Core Domain**
- **Oracle Lumira**: Spiritual guidance platform with tiered access (Initié, Mystique, Profond, Intégral).
- **Key Flows**: Onboarding (Sanctuaire), Checkout (Stripe), AI Readings (Vertex AI), Admin Desk.

## 2. Critical Workflows

**Development**
- Start all: `pnpm dev` (Runs `turbo run dev`).
- **Database**:
  1. Modify `packages/database/prisma/schema.prisma`.
  2. Run `pnpm db:generate` (Updates client).
  3. Run `pnpm db:push` (Updates local DB).
- **Testing**: `pnpm test` (Runs Playwright e2e), `pnpm --filter api test` (Jest).

## 3. Tech Stack & Versions

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React, Framer Motion, Zod, React Hook Form.
- **Backend**: NestJS 10, Passport (JWT), Google Vertex AI SDK, Stripe SDK, AWS S3 Client.
- **Database**: PostgreSQL 15+, Prisma ORM.

## 4. Coding Conventions

### Frontend (`apps/web`)
- **API Calls**: ALWAYS use `lib/api.ts` (Axios instance with auth interceptors). NEVER use `fetch` directly for internal API.
- **Routing**: Use App Router (`app/`). Components default to Server Components. Add `'use client'` for interactivity.
- **Styling**: Tailwind CSS with semantic colors (`text-divine`, `bg-void`, `accent-gold`). Use `cn()` from `@packages/ui` (clsx/tailwind-merge) for class composition.
- **Forms**: `react-hook-form` + `zod` validation.
- **Context**: `AuthContext`, `SanctuaireContext` wrap root layouts. Check entitlements via `useSanctuaire`.

### Backend (`apps/api`)
- **Structure**: Feature-based modules `src/modules/{feature}/` containing:
  - `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`.
- **Config**: NEVER use `process.env` directly. Inject `ConfigService`.
- **Validation**: Use `class-validator` DTOs. Global validation pipe is active.
- **AI Service**: Use `src/services/factory/VertexOracle.ts` for generation logic.

### Shared (`packages/*`)
- **Database**: Import `prisma` from `@packages/database`.
- **UI**: detailed atoms/molecules in `@packages/ui`. Prefer these over creating new ones.

## 5. Integration Patterns

- **Stripe**: Handled via `StripeProvider` (frontend) and `webhooks.controller.ts` (backend).
- **Vertex AI**: configured in `VertexOracle` service. Requires `VERTEX_AI_CREDENTIALS` (JSON).
- **Blob Storage**: AWS S3 client configured in `apps/api`.

## 6. Common Pitfalls to Avoid
- **Schema**: Forgetting `db:generate` after schema changes causes type errors.
- **Auth**: Frontend tokens are stored in localStorage `lumira_token`. API requires `Bearer {token}`.
- **Imports**: Importing directly from `dist` or building relative paths to other workspaces.
- **Types**: Duplicating types. Check `@packages/shared` or Prisma generated types first.
