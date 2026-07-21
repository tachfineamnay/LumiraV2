#!/bin/sh
# Production API boot: recover known rolled-back Prisma failures, migrate, then start Nest.
set -eu

SCHEMA="packages/database/prisma/schema.prisma"

# Migrations that failed in production after a Postgres transactional rollback, then were
# fixed in git. Marking them --rolled-back lets migrate deploy re-apply the fixed SQL.
RECOVERABLE_FAILED_MIGRATIONS="
20260720000100_add_order_scoped_reading_intakes
20260720000000_add_ai_runs
"

recover_failed_migrations() {
  status_out="$(prisma migrate status --schema="$SCHEMA" 2>&1 || true)"
  printf '%s\n' "$status_out"

  printf '%s\n' "$status_out" | grep -qi 'failed migrations\|The following migration.*failed\|migration.*failed' \
    || return 0

  for migration in $RECOVERABLE_FAILED_MIGRATIONS; do
    [ -n "$migration" ] || continue
    if printf '%s\n' "$status_out" | grep -q "$migration"; then
      echo "Recovering failed migration as rolled-back: $migration"
      prisma migrate resolve --rolled-back "$migration" --schema="$SCHEMA"
    fi
  done
}

recover_failed_migrations
prisma migrate deploy --schema="$SCHEMA"
exec node apps/api/dist/main.js
