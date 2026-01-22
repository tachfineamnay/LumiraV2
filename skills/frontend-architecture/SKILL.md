---
name: Frontend Architecture (Next.js)
description: Guidelines for Next.js 14 App Router, Client vs Server components, and State Management.
---

# Frontend Architecture Skills

## Context

The frontend is a **Next.js 14** application using the **App Router**.
Located in `apps/web`.

## Core Principles

1. **Server Components by Default**: Only use `'use client'` when interactivity (hooks, event listeners) is needed.
2. **Clean Architecture**:
    - `components/ui`: Dumb, reusable components (Buttons, Inputs).
    - `components/features`: Smart, domain-specific components (OrderCard, Synthesis).
    - `lib/`: Business logic, schemas, helpers.
    - `hooks/`: Custom React hooks.

## Key Components

### 1. CreationEngine (`CreationEngine.tsx`)

The State Machine for generating readings.

- **States**: `Pending` -> `Generating` -> `Preview` -> `Completed`.
- **UX**: Uses "Optimistic UI" with rotating messages during AI generation.

### 2. Layouts

- `app/layout.tsx`: Root layout with Providers (`AuthProvider`, `StripeProvider`).
- `app/admin/layout.tsx`: Admin-specific layout (Sidebar, Header).

## Data Fetching

- **Server Side**: Direct DB access (via Prisma) or API calls in `page.tsx` (async components).
- **Client Side**: `axios` or `fetch` inside `useEffect` or React Query (if available).

## Routing

- **Subdomains**: `middleware.ts` handles routing strictly:
  - `desk.oraclelumira.com` -> `/admin`
  - `oraclelumira.com` -> `/sanctuary` (or Landing)

## Do's and Don'ts

- **DO** use `zod` for form validation (`react-hook-form`).
- **DON'T** put heavy logic in `page.tsx`; delegate to components.
- **DON'T** expose sensitive credentials in Client Components.
