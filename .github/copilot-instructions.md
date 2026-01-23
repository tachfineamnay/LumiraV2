# Lumira V2 - AI Agent Instructions

## Architecture Overview

This is a **Turborepo monorepo** with strict workspace boundaries:

- **Frontend**: `apps/web` - Next.js 14 (App Router), port 3000
- **Backend**: `apps/api` - NestJS 10, port 3001
- **Shared packages**: `@packages/database` (Prisma client), `@packages/shared` (types/utils), `@packages/ui` (React components)

The app serves **Oracle Lumira**, a spiritual guidance platform with tiered access (Initié/Mystique/Profond/Intégral) and includes admin desk, sanctuaire (user portal), and checkout flows.

## Critical Workflows

### Development
```bash
pnpm dev                    # Start both apps via Turborepo
pnpm db:push                # Push schema changes to local PostgreSQL
pnpm db:generate            # Regenerate Prisma client after schema edits
docker-compose -f docker/docker-compose.yml up -d  # Start local DB
```

### Database
- Schema: `packages/database/prisma/schema.prisma`
- Always run `pnpm db:generate` after modifying schema
- Generated client imported as: `import { prisma } from '@packages/database'`
- Key enums: `OrderStatus`, `SubscriptionStatus`, `ReviewStatus`, `ValidationStatus`

## Project-Specific Conventions

### Backend (NestJS)
- **Module structure**: Each feature lives in `apps/api/src/modules/{feature}/` with `.controller.ts`, `.service.ts`, `.dto.ts`, `.module.ts`
- **Authentication**: JWT-based, guards in `modules/auth/guards/`
- **AI services**: `services/factory/VertexOracle.ts` for Vertex AI integration
- **Rate limiting**: Global `ThrottlerGuard` configured (10 req/60s), override with `@Throttle()` decorator
- **Environment**: Use `ConfigService` injection, never `process.env` directly
- **CORS**: Configured in `main.ts` with explicit allowed origins

Example service pattern:
```typescript
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}
}
```

### Frontend (Next.js)
- **App Router only**: All pages in `apps/web/app/` structure
- **Context providers**: `AuthContext`, `SanctuaireContext`, `ExpertAuthContext`, `StripeProvider` - wrap layouts, not individual pages
- **API calls**: Use `lib/api.ts` helper, never raw `fetch` without auth headers
- **Products**: 4 tiers defined in `lib/products.ts` (initie, mystique, profond, integrale)
- **Capabilities**: Sanctuaire uses entitlements system - check via `SanctuaireContext.hasCapability()`
- **Forms**: React Hook Form + Zod validation (`lib/onboardingSchema.ts` for examples)

### UI/Styling
- **Tailwind**: Custom classes in `tailwind.config.js` - use semantic colors like `text-divine`, `bg-void`, `accent-gold`
- **Fonts**: Inter (sans) + Playfair Display (serif) via `--font-inter`, `--font-playfair` CSS variables
- **Components**: Import from `@packages/ui` when possible (Button, Card, Input), local `components/ui/` for app-specific
- **Icons**: Lucide React only

### Testing
- **E2E**: Playwright in `tests/e2e/`, run `pnpm test` (configured with `--passWithNoTests` for CI)
- **Base URL**: Tests expect `http://localhost:3000`

## Integration Points

### Stripe
- Configured via `StripeProvider` wrapping app
- Webhook handler: `apps/api/src/modules/webhooks/webhooks.controller.ts`
- Products mapped to database via `productId` field

### Vertex AI
- Service: `apps/api/src/services/factory/VertexOracle.ts`
- Requires `VERTEX_AI_PROJECT_ID`, `VERTEX_AI_LOCATION`, `VERTEX_AI_CREDENTIALS` env vars
- Used for generating spiritual readings (lectures, mandalas, rituals)

### n8n (optional)
- Webhook test script: `apps/api/test-n8n-webhook.js`
- Used for workflow orchestration (not critical path)

## Key Files Reference

- **Product tiers**: [apps/web/lib/products.ts](../apps/web/lib/products.ts)
- **Database schema**: [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)
- **API entry**: [apps/api/src/main.ts](../apps/api/src/main.ts)
- **Frontend layout**: [apps/web/app/layout.tsx](../apps/web/app/layout.tsx)
- **Auth context**: [apps/web/context/AuthContext.tsx](../apps/web/context/AuthContext.tsx)
- **Sanctuaire entitlements**: [apps/web/context/SanctuaireContext.tsx](../apps/web/context/SanctuaireContext.tsx)

## Common Patterns

### Adding a new backend feature
1. Create `apps/api/src/modules/{feature}/` directory
2. Add `.module.ts`, `.controller.ts`, `.service.ts`, `.dto.ts`
3. Import module in `app.module.ts`
4. Add database models to `schema.prisma` if needed, then run `pnpm db:generate && pnpm db:push`

### Adding a new frontend route
1. Create folder in `apps/web/app/{route}/`
2. Add `page.tsx` (server component by default) or `'use client'` directive for client component
3. For authenticated routes, wrap with `AuthGuard` component
4. For sanctuaire routes, check entitlements via `SanctuaireContext`

### Workspace imports
- Always use workspace aliases: `@packages/database`, `@packages/shared`, `@packages/ui`
- Never relative imports across workspace boundaries (`../../packages/...`)

## Don't Do This
- Don't create new context providers without checking existing ones
- Don't use `prisma` directly in controllers - always via service layer
- Don't hardcode API URLs - use `process.env.NEXT_PUBLIC_API_URL` or lib/api.ts
- Don't mix server/client components - be explicit with `'use client'` directive
- Don't add dependencies to root package.json - use workspace-specific `pnpm --filter {package} add {dep}`
