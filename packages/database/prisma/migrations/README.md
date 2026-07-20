# Prisma Migrations

Production deployments use `prisma migrate deploy` (see `apps/api/Dockerfile`).

## Existing databases (migrated via `db push`)

If the database already has the schema from a previous `db push` deployment, baseline the initial migration once:

```bash
pnpm --filter @packages/database exec prisma migrate resolve --applied 20250617000000_init
```

Then future deploys will apply only new migrations.

## Failed migration recovery (P3009)

If deploy logs show `P3009` for `20260720000000_add_ai_runs`, the migration was marked failed in
`_prisma_migrations` (often because `AiMission` was missing from an earlier schema drift). After pulling
the fixed migration SQL:

1. Mark the failed attempt as rolled back (safe when PostgreSQL rolled back the transaction):

```bash
pnpm --filter @packages/database exec prisma migrate resolve --rolled-back 20260720000000_add_ai_runs
```

2. Redeploy or run:

```bash
pnpm --filter @packages/database exec prisma migrate deploy
```

On Coolify, run step 1 once in the API container shell (or a one-off job with `DATABASE_URL`), then trigger a new deployment.
