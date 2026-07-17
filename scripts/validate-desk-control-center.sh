#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  printf '\n\033[1;36m==> %s\033[0m\n' "$1"
}

log "Install dependencies"
pnpm install --frozen-lockfile

log "Generate Prisma client"
pnpm db:generate

log "Run focused API tests"
pnpm --filter @lumira/api test -- \
  production-control.types.spec.ts \
  production-control.service.spec.ts \
  production-cancel.interceptor.spec.ts \
  production-paid-recovery.service.spec.ts \
  client-control.service.spec.ts \
  client-sanctuaire.interceptor.spec.ts \
  AudioGenerationService.spec.ts \
  guidance-request.types.spec.ts \
  guidance-requests.service.spec.ts \
  guidance-response.interceptor.spec.ts \
  guidance-reply-recovery.interceptor.spec.ts \
  --runInBand

log "Typecheck"
pnpm typecheck

log "Lint"
pnpm lint

log "Full unit test suite"
pnpm test

log "Production build"
pnpm build

if [[ "${RUN_PLAYWRIGHT:-false}" == "true" ]]; then
  log "Playwright"
  pnpm exec playwright test
else
  printf '\nPlaywright skipped. Re-run with RUN_PLAYWRIGHT=true after services and test data are available.\n'
fi

printf '\n\033[1;32mLumira main integration validation completed.\033[0m\n'
