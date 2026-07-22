---
name: lumira-data-migrations
description: Modifier, migrer, fiabiliser ou auditer les données Lumira avec PostgreSQL et Prisma 5.22 : schéma, relations, index, transactions, compatibilité legacy, seeds et migrations de production. À utiliser pour tout changement de modèle ou bug de cohérence en base.
---

# Lumira — Données et migrations Prisma

## Source de vérité

Le schéma actif est `packages/database/prisma/schema.prisma`. Vérifier le `package.json` du package database avant d'utiliser une syntaxe ou une commande Prisma : le projet utilise Prisma 5.22.

## Discipline de changement

1. Rechercher tous les usages du modèle, champ ou enum dans API, web, tests, seeds et scripts.
2. Définir la migration des données existantes avant de rendre un champ obligatoire ou de supprimer une valeur.
3. Modifier le schéma.
4. Créer une migration versionnée dans `packages/database/prisma/migrations/`.
5. Régénérer le client.
6. Adapter services, DTO, types partagés, fixtures et tests.
7. Tester une base existante, pas seulement une base vide.

Ne pas utiliser `db push` comme stratégie de production. Il reste acceptable uniquement pour une expérimentation locale explicitement jetable.

## Modèles critiques

Porter une attention particulière à :

- `User`, `UserProfile`, `SanctuaireLoginToken` ;
- `Order`, `OrderFile`, `ProductOrder`, `ProcessedEvent` ;
- `Expert`, `Product` ;
- `Insight`, `SpiritualPath`, `PathStep`, `Dream`, `ChatSession`, `AkashicRecord` ;
- `SystemSetting`, `PromptVersion`, `AiRoutingRule`, `SequenceCounter` ;
- le modèle legacy `Subscription` et les anciens champs de statut.

Le droit d'accès Sanctuaire actuel doit être dérivé d'une commande payée et des entitlements existants, pas d'un modèle d'abonnement legacy.

## Cohérence et concurrence

- Utiliser une transaction pour toute opération qui doit réussir ou échouer ensemble.
- Utiliser contraintes uniques, index et transitions atomiques plutôt qu'un simple contrôle préalable vulnérable aux courses.
- Les webhooks, générations, compteurs et consommations de token doivent être idempotents.
- Définir explicitement `onDelete` et les conséquences de suppression.
- Ne pas dupliquer des données calculables sauf besoin de performance documenté et stratégie de synchronisation.

## Compatibilité legacy

Avant de supprimer un champ, enum, table ou endpoint historique :

1. rechercher les lectures et écritures actives ;
2. vérifier les données réelles susceptibles d'exister ;
3. prévoir backfill ou conversion ;
4. livrer d'abord une version compatible avec ancien et nouveau format si nécessaire ;
5. supprimer seulement dans une migration ultérieure après preuve d'inutilisation.

## Performance

- Indexer les recherches réelles : statut + date, propriétaire + date, identifiant externe, token et événements.
- Éviter les N+1 dans le Desk et le Sanctuaire.
- Sélectionner uniquement les colonnes nécessaires pour les listes.
- Paginer les clients, commandes, logs et historiques.
- Mesurer avant d'ajouter un index redondant.

## Commandes

```bash
pnpm db:generate
pnpm --filter @packages/database db:migrate
pnpm --filter @packages/database build
pnpm typecheck
pnpm test
```

Pour la production, utiliser `prisma migrate deploy` via le workflow Docker/Coolify prévu.

## Tests requis

- migration sur données existantes représentatives ;
- rollback logique ou stratégie de récupération documentée pour changement risqué ;
- contraintes uniques et concurrence ;
- cascade/suppression ;
- seed reproductible ;
- requêtes d'entitlements et états de commande.

## Critères d'acceptation

- Aucun changement de schéma sans migration ou justification locale explicite.
- Le client Prisma généré, l'API et les tests compilent ensemble.
- Les anciennes données restent lisibles ou sont migrées.
- Les contraintes empêchent les doublons métier attendus.
- Le déploiement peut appliquer la migration sans intervention manuelle improvisée.

## Configuration IA Desk (inviolable en prod)

Source de vérité runtime pour les lectures :

| Donnée                        | Table / source                     | SoT                                                                      |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Prompts agents + `LUMIRA_DNA` | `PromptVersion` (`isActive`)       | Oui                                                                      |
| Modèles / providers           | `PromptVersion` clé `MODEL_CONFIG` | Oui                                                                      |
| Credentials Vertex            | `SystemSetting` chiffré            | Oui                                                                      |
| Clés OpenAI / Gemini          | variables d'environnement          | Oui                                                                      |
| `AiRoutingRule`               | table legacy                       | **Non** — Tranche A ignore la matrice ; ne pas la réintroduire comme SoT |

Interdit dans toute nouvelle migration SQL :

- `UPDATE "PromptVersion" SET "isActive" = false` massif sur les clés métier ;
- `INSERT INTO "PromptVersion"` forçant `MODEL_CONFIG` / prompts fondateur sans garde « seulement si aucune ligne active » ;
- `UPDATE "PromptVersion" SET "value"` sur `MODEL_CONFIG` (mutation in-place) — créer une nouvelle version active si un changement de données est vraiment nécessaire, ou ne pas toucher.

Autorisé : seed **uniquement** si aucune version `isActive` n'existe pour la clé (`INSERT … WHERE NOT EXISTS`).

Les défauts dans le code API (`getDefaultPrompts`, `DEFAULT_AI_MODEL_CONFIG`) sont un fallback runtime, jamais une raison d'écraser la DB au deploy.
