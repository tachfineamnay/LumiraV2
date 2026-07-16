---
name: lumira-quality-release
description: Valider, stabiliser et préparer la release Lumira : typecheck, lint, Jest, Playwright, CI, Docker, migrations, variables Coolify, healthchecks et diagnostic de build. À utiliser avant merge/déploiement, pour une CI rouge ou pour déclarer le projet lançable.
---

# Lumira — Qualité, CI et release

## Principe

Une release n'est pas « prête » parce qu'un build local isolé passe. Elle est prête lorsque le code, la base, les intégrations et les parcours critiques sont validés dans des conditions proches de la production.

## Baseline

Avant correction :

1. vérifier branche, `git status --short` et diff ;
2. noter versions Node/pnpm ;
3. installer avec lockfile figé ;
4. générer Prisma ;
5. exécuter le contrôle ciblé qui reproduit l'échec ;
6. conserver le message d'erreur exact avant de modifier.

Ne pas masquer une erreur par `continue-on-error`, désactivation de règle, `any`, suppression de test ou catch vide sauf décision explicitement justifiée et compensée.

## Ordre des contrôles

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

Commencer par le package touché pour accélérer, puis exécuter les commandes racine avant merge.

## Tests

- Jest : services, guards, transitions, idempotence, erreurs provider et permissions.
- Playwright : achat simulé, arrivée post-checkout, login magique, onboarding, consultation, actions Desk critiques.
- Les mocks doivent remplacer les fournisseurs externes, pas contourner la logique métier testée.
- Un script qui répond « No tests yet » ou `passWithNoTests` n'est pas une couverture.
- Corriger les fixtures lorsqu'elles ne représentent plus le schéma actuel.
- Stabiliser les tests par attentes déterministes, pas par délais arbitraires.

## CI

Reproduire `.github/workflows/ci.yml` localement autant que possible :

- Node 20 ;
- pnpm 8 pour installation et commandes workspace ;
- Prisma généré avant typecheck/build ;
- audit haut niveau avec la stratégie actuelle du workflow ;
- Chromium Playwright installé pour E2E.

Toute divergence volontaire entre local et CI doit être documentée.

## Docker et Coolify

Inspecter `apps/api/Dockerfile`, `apps/web/Dockerfile`, les fichiers Docker racine et la configuration de migration.

Vérifier :

- build des packages partagés avant les apps ;
- présence des artefacts `dist` et `.next` attendus ;
- utilisateur non-root lorsque prévu ;
- ports et healthchecks cohérents ;
- `DATABASE_URL` et URLs internes/externes correctes ;
- migration `prisma migrate deploy` exécutée une seule fois de manière sûre ;
- Gotenberg, S3, SMTP, Stripe et providers accessibles depuis le réseau de production ;
- aucune variable `NEXT_PUBLIC_*` contenant un secret.

## Préflight environnement

Comparer les variables réellement lues dans le code avec `.env.example` et la configuration Coolify. Classer :

- requise au démarrage ;
- requise pour une fonctionnalité ;
- optionnelle avec fallback sûr ;
- obsolète à supprimer.

Échouer avec un message exploitable lorsque la fonctionnalité critique ne peut pas fonctionner.

## Smoke tests de release

Après déploiement ou en environnement proche :

1. healthcheck web et API ;
2. chargement landing et checkout ;
3. création d'une session de test contrôlée ;
4. auth expert ;
5. lecture/écriture DB minimale ;
6. webhook Stripe test ;
7. génération IA mockée ou canary limitée ;
8. PDF/S3 et e-mail test ;
9. logs sans secret ni boucle d'erreur.

## Diagnostic de panne

Pour une CI rouge :

1. reproduire exactement la commande ;
2. identifier le premier échec causal, pas les erreurs en cascade ;
3. vérifier version, cache, génération Prisma et résolution workspace ;
4. corriger la cause minimale ;
5. relancer le contrôle fautif puis la chaîne complète.

## Rapport de release

Produire :

- SHA/branche testée ;
- commandes et résultats ;
- migrations incluses ;
- variables ou services externes requis ;
- parcours smoke réellement vérifiés ;
- risques et rollback ;
- décision explicite : prêt, prêt sous condition, ou bloqué.
