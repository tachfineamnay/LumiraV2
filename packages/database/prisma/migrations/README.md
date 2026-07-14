# Prisma Migrations

Production deployments use `prisma migrate deploy` (see `apps/api/Dockerfile`).

## Existing databases (migrated via `db push`)

If the database already has the schema from a previous `db push` deployment, baseline the initial migration once:

```bash
pnpm --filter @packages/database exec prisma migrate resolve --applied 20250617000000_init
```

Then future deploys will apply only new migrations.
