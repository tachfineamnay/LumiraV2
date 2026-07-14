# Audit Stack Lumira V2 — Rapport & Remédiation

**Date**: 15 juillet 2026 (mise à jour inspection bugs)  
**Périmètre**: Architecture plateforme (monorepo, auth, paiements, desk, CI/CD, Docker, observabilité)

---

## Résumé

| Domaine | Avant audit initial | Après Phase 1–3 | Après remédiation bugs (juil. 2026) |
|---------|---------------------|-----------------|-------------------------------------|
| Sécurité auth | 5/10 | 7/10 | 8/10 |
| Sécurité paiements | — | 4/10 | 8/10 |
| Ops / Déploiement | 5/10 | 7/10 | 8/10 |
| CI/CD | 6/10 | 8/10 | 8/10 |
| Observabilité | 3/10 | 6/10 | 6/10 |

---

## Corrections appliquées (Phase 1–3 — juin 2025)

### Phase 1 — Critique

- [x] **C1** — Suppression du fallback `defaultSecret` dans `jwt.strategy.ts`
- [x] **C4** — Retrait de `PENDING` (amount > 0) dans `findUserWithPaidOrder()` + normalisation email
- [x] **C3** — Séparation `sanctuaireApi` / `expertApi`
- [x] **E1** — `prisma migrate deploy` + migration initiale

### Phase 2 — Élevé

- [x] **E3** — Suppression de `ignoreBuildErrors` / `ignoreDuringBuilds`
- [x] **E4** — Job Playwright E2E
- [x] **M8** — `pnpm audit` en CI
- [x] **E2/M4** — Docker API : frozen-lockfile, Prisma aligné
- [x] **M2/M5/M1** — `.env.example` + JWT unification

### Phase 3 — Moyen

- [x] **C2** — Cookies httpOnly Sanctuaire via BFF
- [x] **E5** — RequestId + logs HTTP
- [x] Helmet, Husky, Dependabot, Throttler unique, VertexOracle mock

---

## Remédiation bugs Critiques / Hauts (juil. 2026)

### Vague 1 — Paiements / Auth API

- [x] Prix checkout **serveur-only** (`CHECKOUT_CATALOG`, ignore `amountCents` client)
- [x] Fermeture bypass `PENDING + amount 0` pour login Sanctuaire
- [x] `registerSanctuaire` : create-if-missing, **plus de JWT**
- [x] Statut `PAID` réservé au webhook ; `CANCELLED` → `REFUNDED`
- [x] Upsell / `orders/recent` sous JWT + ownership ; `confirmUpsell` bound to PI metadata
- [x] Webhook : process-then-mark processedEvent (retry Stripe si échec)

### Vague 2 — Runtime desk / Sanctuaire

- [x] `assignOrder` ReferenceError (`updatedOrder.orderNumber`)
- [x] Endpoints `PATCH /expert/orders/:id/status` et `/draft`
- [x] Génération refuse les commandes `PENDING` unpaid
- [x] Select Prisma `role` retiré de `User.findAll`
- [x] Preferences : chemins BFF `/client/...` (plus de double `/api`)

### Vague 3 — httpOnly Sanctuaire

- [x] Consommateurs migrés vers `sanctuaireApi` (plus de `localStorage.sanctuaire_token`)
- [x] Session route : vérif JWT HS256 + Origin
- [x] BFF : allowlist + Origin sur mutateurs + clear cookie sur 401
- [x] E2E mocks BFF + landing assertions alignées

### Vague 4 — Ops

- [x] Docker Compose : `JWT_SECRET` / `JWT_EXPIRATION` / `WEB_URL`
- [x] Align défauts JWT `30d` + `JWT_EXPIRES_IN` dans `.env.example`
- [x] Migration `20260715000000_add_missing_indexes`
- [x] Normalisation email expert

---

## Actions post-déploiement

1. **Baseline migration** sur BDD déjà en `db push` :
   ```bash
   pnpm --filter @packages/database exec prisma migrate resolve --applied 20250617000000_init
   pnpm --filter @packages/database exec prisma migrate deploy
   ```
2. **Configurer `JWT_SECRET`** en prod (API + Next.js web pour vérif session)
3. Optionnel : Sentry via `SENTRY_DSN`

---

## Backlog restant (Phase 4+)

- Magic link / OTP (remplace login passwordless email-only)
- Expert tokens httpOnly + refresh distinct (`typ: 'refresh'`)
- Upgrade Next.js 15
- Consolidation providers AI
- Audit logging actions admin desk
- Réduction body parser 50MB + throttling uploads

---

Voir aussi : [`AUDIT_SANCTUAIRE.md`](AUDIT_SANCTUAIRE.md) pour l'audit domaine Sanctuaire.
