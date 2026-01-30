# Lumira V2 - AI Agent Instructions

## Architecture Overview

**Turborepo + pnpm 8.15.4 monorepo** with strict workspace boundaries:

```
apps/web     → Next.js 14 (App Router) - Sanctuaire (user portal) + Admin Desk
apps/api     → NestJS 10 - REST API with JWT auth + AI generation
packages/database → Prisma schema + generated client
packages/shared   → Types, constants, entitlements
packages/ui       → Shared React components
```

**Domain**: Spiritual guidance platform (Oracle Lumira) with 4 tiers:
- **Initié** (29€) → **Mystique** (59€) → **Profond** (99€) → **Intégral** (149€)

**Core Flow**: User onboarding → Stripe checkout → AI reading (VertexOracle) → Expert review → Delivery

---

## Critical Commands

```bash
pnpm dev                              # Start all (web:3000, api:3001)
pnpm db:generate && pnpm db:push      # ALWAYS run both after schema changes
pnpm --filter web dev                 # Single app
pnpm --filter api test                # Jest tests
npx playwright test                   # E2E tests
```

---

## Import Rules (STRICT)

```typescript
// ✅ CORRECT - Use workspace aliases
import { prisma } from '@packages/database';
import { CATALOG_CATEGORIES } from '@packages/shared';
import api from '@/lib/api';

// ❌ WRONG - Never relative paths across workspaces
import { prisma } from '../../packages/database';
```

---

## Frontend Patterns (`apps/web`)

**API calls** - Always use `lib/api.ts` (has auth interceptors):
```typescript
import api from '@/lib/api';
const { data } = await api.get('/users/entitlements');
```

**Styling** - Use `cn()` for class composition with Lumira colors:
```typescript
import { cn } from '@/lib/utils';
<div className={cn("bg-abyss-700 text-stellar-100", hover && "bg-abyss-600")} />
```

**Key colors**: 
- `abyss-*` (navy backgrounds: 700 main, 600 elevated)
- `horizon-*` (gold accents: 400 primary)
- `stellar-*` (white text: 100 bright, 400 muted)
- `serenity-*` (teal accents)

**Auth tokens**: 
- `lumira_token` / `sanctuaire_token` → Sanctuaire users
- `expert_token` → Admin desk

**Subdomain routing**: `desk.oraclelumira.com` → `/admin/*` (via `middleware.ts`)

**Entitlements check**:
```tsx
const { hasCapability, highestLevel } = useSanctuaire();
if (!hasCapability('chat_unlimited')) return <UpgradePrompt />;
```

---

## Backend Patterns (`apps/api`)

**Module structure** - Feature-based in `src/modules/{feature}/`:
```
orders/
├── orders.module.ts
├── orders.controller.ts
├── orders.service.ts
└── dto/create-order.dto.ts
```

**Config** - Never `process.env` directly:
```typescript
constructor(private configService: ConfigService) {}
const secret = this.configService.get<string>('JWT_SECRET');
```

**AI Generation** - `VertexOracle` service (`src/services/factory/`) with 4 agents:
- **SCRIBE**: PDF reading generation (8 domains, synthesis)
- **GUIDE**: 7-day spiritual timeline
- **EDITOR**: Content refinement per expert feedback
- **CONFIDANT**: Real-time chat

All agents share `LUMIRA_DNA` personality (French, mystical, warm).

**PDF Generation** - `PdfFactory` with Handlebars templates + Gotenberg

---

## Database (`packages/database`)

After schema changes:
1. Edit `packages/database/prisma/schema.prisma`
2. Run `pnpm db:generate` → Updates TypeScript types
3. Run `pnpm db:push` → Applies to DB

**Key models**:
- `User` → `UserProfile` (1:1, onboarding data)
- `Order` → `OrderFile[]` (purchases + uploaded photos)
- `SpiritualPath` → `PathStep[]` (7-day journey)
- `Insight` (8 categories, one per user)
- `AkashicRecord` (persistent AI memory)
- `ChatSession` (conversation history)
- `Expert` (admin users with roles)

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| API client with auth | `apps/web/lib/api.ts` |
| Class composition utility | `apps/web/lib/utils.ts` |
| Tailwind colors | `apps/web/tailwind.config.js` |
| Subdomain routing | `apps/web/middleware.ts` |
| User entitlements | `apps/web/context/SanctuaireContext.tsx` |
| AI multi-agent | `apps/api/src/services/factory/VertexOracle.ts` |
| PDF generation | `apps/api/src/services/factory/PdfFactory.ts` |
| Prisma schema | `packages/database/prisma/schema.prisma` |

---

## Common Pitfalls

| Problem | Solution |
|---------|----------|
| Type errors after schema change | Run `pnpm db:generate` |
| API calls missing auth | Use `lib/api.ts`, not `fetch` |
| Duplicating types | Check `@packages/shared` or Prisma types first |
| Wrong auth token | `lumira_token` for users, `expert_token` for admins |
| Colors not working | Use `abyss-*`, `horizon-*`, `stellar-*` (not `void`, `gold`) |

---

## Skills Documentation

Detailed guides in `skills/` folder:
- `01-monorepo` - Turborepo & pnpm workspace management
- `02-database` - Prisma patterns & migrations
- `03-backend` - NestJS module architecture
- `04-frontend` - Next.js 14 App Router patterns
- `05-design-system` - Tailwind colors & glassmorphism
- `07-ai-integration` - Gemini API & prompt engineering
- `13-vertex-oracle` - Multi-agent AI architecture
- `14-sanctuaire-flow` - User journey & entitlements
- `15-admin-desk` - Expert portal & order review
- `16-stripe-integration` - Payments & webhooks
- `17-pdf-generation` - Handlebars + Gotenberg
- `18-data-models` - Complete schema reference
