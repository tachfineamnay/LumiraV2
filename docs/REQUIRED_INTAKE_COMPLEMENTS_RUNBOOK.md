# Dossiers obligatoires et compléments — runbook manuel

## Périmètre

Cette livraison impose cinq éléments avant toute nouvelle production :

1. date de naissance ;
2. lieu de naissance ;
3. intention (`QUESTION`, `SITUATION` ou `OPEN`) ;
4. photo du visage ;
5. photo de la paume.

Elle ajoute un workflow gratuit de complément demandé par l’expert. Elle ne contient aucun upsell, paiement ou produit Stripe.

## Invariants de données

- `ReadingIntake` scellé reste immuable.
- Une approbation crée un nouveau `ReadingInputSnapshot`.
- `Order.clientInputs.readingIntakeEffective` référence la projection approuvée.
- Les anciennes `ReadingVersion`, PDF, audios, fichiers et livraisons ne sont ni supprimés ni remplacés.
- Une approbation ne lance jamais automatiquement une génération.
- Les références `s3://onboarding/...` ne doivent jamais apparaître dans une réponse JSON publique.

## Prévalidation locale obligatoire

Depuis la racine du dépôt :

```bash
pnpm install --frozen-lockfile
pnpm db:generate

pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test -- --runInBand reading-intake
pnpm --filter api test -- --runInBand reading-amendment
pnpm --filter api test -- --runInBand reading-source
pnpm --filter api build

pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web build
pnpm --filter web exec playwright test \
  e2e/sanctuaire-intake-sealing.spec.ts \
  e2e/required-intake-complements.spec.ts
```

Aucun déploiement ne doit commencer si une commande échoue.

## Diagnostic historique read-only

```bash
pnpm --filter api audit:intake-completeness
```

Le script ne modifie aucune ligne et ne journalise aucune donnée personnelle. Il retourne uniquement des compteurs agrégés.

## Avant déploiement

1. Noter le SHA exact de `main` et le SHA à déployer.
2. Réaliser une sauvegarde PostgreSQL vérifiée.
3. Vérifier la présence des lectures, PDF, audios et fichiers de plusieurs commandes existantes.
4. Positionner temporairement `PRODUCTION_WORKER_ENABLED=false`.
5. Préparer une commande de test séparée des commandes clientes.

## Ordre de déploiement

1. Déployer l’API avec le worker désactivé.
2. Appliquer uniquement les migrations Prisma en attente avec la commande de déploiement habituelle du projet.
3. Vérifier que la migration `20260805165000_add_profile_field_amendment_kind` est appliquée une seule fois.
4. Vérifier les logs de démarrage API.
5. Tester les endpoints de santé et l’authentification Expert/Client.
6. Déployer le Web.
7. Exécuter les smoke tests ci-dessous.
8. Réactiver le worker uniquement après un résultat complet.

Ne jamais utiliser `prisma db push` en production.

## Smoke test — dossier initial

Sur une commande de test :

- soumission sans intention : refus `READING_INTAKE_INCOMPLETE` ;
- soumission sans visage : refus ;
- soumission sans paume : refus ;
- soumission avec les cinq éléments : succès ;
- Desk : `5/5 éléments obligatoires complets` ;
- production : génération autorisée ;
- snapshot : `requirementsVersion=2026-08-05-required-intake-v2`.

## Smoke test — complément

Sur une commande contrôlée :

1. L’expert demande un ou plusieurs champs précis.
2. La notification interne est créée.
3. L’email mentionne la commande, les éléments et l’échéance.
4. Le client voit uniquement les champs demandés.
5. Le client enregistre un brouillon, recharge puis reprend.
6. Le client transmet.
7. Le Desk affiche l’ancienne et la nouvelle valeur/photo.
8. L’expert approuve.
9. Un nouveau `ReadingInputSnapshot` est créé.
10. Le `ReadingIntake` original est inchangé.
11. Le Sanctuaire affiche la projection approuvée.
12. Une révision reste une action manuelle et n’est disponible qu’en `5/5`.
13. L’ancienne lecture, le PDF et l’audio restent accessibles.

## Smoke test — sécurité

- un client ne peut pas lire ou modifier le complément d’un autre client ;
- un expert non authentifié ou sans rôle est refusé ;
- une photo privée n’est pas accessible sans authentification ;
- aucune réponse JSON ne contient `s3://onboarding/` ;
- un champ hors catalogue est refusé ;
- une propriété arbitraire dans le bloc intention est refusée ;
- une révision obsolète retourne `409 AMENDMENT_REVISION_CHANGED` ;
- une double soumission ne produit qu’une mutation.

## Surveillance post-déploiement

Surveiller au minimum :

- erreurs HTTP 500 ;
- codes `READING_INTAKE_INCOMPLETE` et `AMENDMENT_REVISION_CHANGED` ;
- échecs de conversion HEIC/HEIF ;
- erreurs S3 ;
- emails de demande ;
- jobs bloqués `WAITING_CLIENT` ;
- génération et création des versions ;
- disponibilité des anciennes livraisons.

## Rollback

En cas d’incident :

1. désactiver le worker ;
2. redéployer l’ancien SHA Web ;
3. redéployer l’ancien SHA API ;
4. ne pas supprimer la migration additive ;
5. ne supprimer aucun snapshot ou amendement ;
6. ne modifier ni PDF, ni audio, ni livraison ;
7. conserver les logs et documenter la commande concernée sans exposer de PII.

La migration additive peut rester en base après rollback applicatif.
