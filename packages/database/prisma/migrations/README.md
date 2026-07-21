# Prisma Migrations

Production deployments use `scripts/api-entrypoint.sh` via `apps/api/Dockerfile`:
recover known P3009 failures → `prisma migrate deploy` → start Nest.

## Existing databases (migrated via `db push`)

If the database already has the schema from a previous `db push` deployment, baseline the initial migration once:

```bash
pnpm --filter @packages/database exec prisma migrate resolve --applied 20250617000000_init
```

Then future deploys will apply only new migrations.

## Failed migration recovery (P3009)

When a migration fails inside a PostgreSQL transaction, Prisma keeps a failed row in
`_prisma_migrations` and blocks all later deploys with **P3009**.

The API entrypoint auto-recovers these known cases (SQL fixed in git, DDL rolled back):

- `20260720000100_add_order_scoped_reading_intakes` (jsonb `-` operator cast)
- `20260720000000_add_ai_runs`

Manual recovery (Coolify API shell / one-off with `DATABASE_URL`):

```bash
prisma migrate resolve --rolled-back 20260720000100_add_order_scoped_reading_intakes \
  --schema=packages/database/prisma/schema.prisma
prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

Only mark `--rolled-back` when the failed migration did **not** leave partial schema
(Postgres transactional migrations). Never use `--applied` to skip a broken migration
without verifying the schema matches `schema.prisma`.
