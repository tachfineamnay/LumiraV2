---
name: Database & Prisma
description: Guidelines for using PostgreSQL, Prisma ORM, and database migrations.
---

# Database & Prisma Skills

## Context

The project uses **PostgreSQL 16** managed by **Prisma ORM**.
The schema is defined in `packages/database/prisma/schema.prisma`.
The client is generated into `@packages/database`.

## Core Principles

1. **Single Source of Truth**: The `schema.prisma` file is the absolute authority on the database structure.
2. **Type Safety**: Always use the generated Prisma types. Never manually type database responses if possible.
3. **Migrations**: Database changes must be applied via migrations, not direct SQL execution.

## Usage Instructions

### 1. Modifying the Schema

1. Edit `packages/database/prisma/schema.prisma`.
2. Run `pnpm db:generate` to update the client types.
3. Run `pnpm db:migrate` (or via Turbo) to create and apply a migration.

### 2. Best Practices

- **Enums**: Use Enums for finite states (e.g., `OrderStatus`, `ExpertRole`).
- **Indexes**: Always index foreign keys and frequently searched fields (e.g., `@@index([userId])`).
- **Relations**: Use explicit relation names if there are multiple relations between two models.

### 3. Common Commands

```bash
# Generate client
pnpm db:generate

# Push changes (prototyping only)
pnpm db:push

# Create migration
pnpm db:migrate --name describe_change
```

### 4. Transactions

For critical operations (e.g. Order Processing), ALWAYS use `$transaction`.

```typescript
await prisma.$transaction(async (tx) => {
  // Operations here are atomic
});
```
