# Déploiement manuel — demandes de complément de lecture

Ce chantier ajoute un parcours ciblé permettant à un expert de demander une photo de paume après livraison, sans modifier le dossier initial ni supprimer les versions, PDF, audios ou livraisons existantes.

## Invariants à préserver

- `ReadingIntake` scellé : jamais modifié.
- `ReadingVersion` V1, `DeliveryRecord`, PDF et audio historiques : jamais supprimés.
- La nouvelle paume est un objet S3 privé distinct.
- La V2 utilise un `ReadingInputSnapshot` immuable.
- Chaque candidate V2 référence son snapshot exact avec `ReadingVersion.inputSnapshotId`.
- Les mémoires issues de la commande corrigée sont exclues du contexte pendant la génération V2.
- Une photo transmise avant l’échéance reste vérifiable après l’échéance.
- Une demande de reprise reçoit une nouvelle fenêtre de sept jours.
- Un seul lancement V2 peut être réclamé à la fois.
- La purge complète d’un client est réservée au rôle `ADMIN`.

## Avant déploiement

1. Faire une sauvegarde PostgreSQL vérifiée.
2. Conserver les cinq flags mémoire à `false` pendant le premier smoke test :

```env
VERTEX_MEMORY_ENABLED=false
VERTEX_MEMORY_READ_ENABLED=false
VERTEX_MEMORY_WRITE_ENABLED=false
VERTEX_MEMORY_AUTO_APPROVE=false
MEMORY_WORKER_ENABLED=false
```

3. Vérifier les variables déjà nécessaires aux emails, au stockage privé et au front :

```env
WEB_URL=https://oraclelumira.com
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_S3_BUCKET=...
```

Aucune nouvelle variable d’environnement n’est introduite par ce chantier.

## Validation locale recommandée

Depuis la racine :

```bash
pnpm install --frozen-lockfile
pnpm --filter @packages/database db:prepare-schema
pnpm --filter @packages/database db:generate
pnpm --filter api typecheck
pnpm --filter api test -- --runInBand reading-amendment
pnpm --filter api test -- --runInBand reading-input-snapshot
pnpm --filter api test -- --runInBand client-purge.controller
pnpm --filter web typecheck
pnpm --filter api build
pnpm --filter web build
```

La commande `db:prepare-schema` génère `packages/database/prisma/schema.runtime.prisma`. Ce fichier est volontairement ignoré par Git et rassemble le schéma historique, les relations Prisma et les modèles additifs du chantier.

Le Dockerfile API passe déjà par le build du package base de données. L’entrypoint de production régénère également `schema.runtime.prisma` avant `prisma migrate status` et `prisma migrate deploy`, afin que build, migrations et client Prisma utilisent exactement le même schéma.

## Migration de production

Appliquer la migration avant de démarrer la nouvelle API :

```bash
pnpm --filter @packages/database db:migrate:deploy
```

La migration `20260802123000_add_reading_intake_amendments` est additive :

- création de `ReadingIntakeAmendment` ;
- création de `ReadingInputSnapshot` ;
- ajout nullable de `ReadingVersion.inputSnapshotId` ;
- ajout d’index, contraintes et triggers de cohérence ;
- aucune suppression, aucun backfill et aucune réécriture historique.

Vérifications SQL après migration :

```sql
SELECT to_regclass('public."ReadingIntakeAmendment"');
SELECT to_regclass('public."ReadingInputSnapshot"');

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'ReadingVersion'
  AND column_name = 'inputSnapshotId';

SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
  'ReadingIntakeAmendment_extend_retake_expiry',
  'ReadingInputSnapshot_sync_amendment_ids'
)
ORDER BY trigger_name;

SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "ReadingVersion";
SELECT COUNT(*) FROM "DeliveryRecord";
```

Comparer les trois derniers compteurs avec les valeurs prises avant migration.

## Ordre de redéploiement

1. Sauvegarde PostgreSQL.
2. Migration additive.
3. Redéploiement API.
4. Vérification `/api/health` et des logs de génération du schéma/migration.
5. Redéploiement web.
6. Smoke test complet avec un compte de test.
7. Activation éventuelle de la Memory Bank dans un second temps seulement.

## Smoke test manuel obligatoire

Utiliser une commande de test livrée ou une copie anonymisée d’un parcours équivalent.

1. Ouvrir une commande `COMPLETED` dans le Desk.
2. Cliquer sur **Demander une photo de la paume**.
3. Vérifier la notification Sanctuaire et l’email unique.
4. Vérifier qu’une commande `FAILED` ou non révisable refuse la création de la demande.
5. Ouvrir le Sanctuaire sur iPhone ou Android.
6. Tester séparément **Appareil photo** et **Galerie**.
7. Tester un fichier trop lourd et un format non autorisé.
8. Enregistrer un brouillon, recharger la page et reprendre.
9. Transmettre la photo.
10. Attendre ou dépasser artificiellement l’échéance : la photo `SUBMITTED` doit rester disponible dans le Desk.
11. Vérifier que l’expert voit exactement l’objet transmis, via la route liée à la commande et au complément.
12. Demander une reprise après l’échéance et vérifier que la nouvelle échéance est repoussée d’au moins sept jours.
13. Transmettre une deuxième photo puis l’approuver.
14. Vérifier la présence d’un `ReadingInputSnapshot` et l’absence de modification du `ReadingIntake` initial.
15. Vérifier que `ReadingInputSnapshot.amendmentIds` correspond exactement à `data->'amendmentIds'`.
16. Double-cliquer volontairement sur **Créer une version révisée** : un seul lancement doit être accepté.
17. Vérifier que la V1, son PDF, son audio et ses `DeliveryRecord` restent présents.
18. Vérifier que la génération utilise la nouvelle paume et crée une version enfant.
19. Vérifier que la candidate V2 possède le bon `inputSnapshotId`.
20. Simuler un échec de génération : le verrou doit être libéré et V1 doit rester livrée.
21. Sceller V2, produire le nouveau PDF/audio et effectuer une nouvelle livraison.
22. Avec un compte expert standard, vérifier que `DELETE /expert/clients/:id/purge` est refusé ; avec un compte `ADMIN`, vérifier le comportement uniquement sur un client de test.

Contrôles SQL utiles après la création de V2 :

```sql
SELECT
  snapshot."id",
  snapshot."revision",
  snapshot."amendmentIds",
  snapshot."data"->'amendmentIds' AS json_amendment_ids,
  version."id" AS reading_version_id,
  version."inputSnapshotId"
FROM "ReadingInputSnapshot" snapshot
LEFT JOIN "ReadingVersion" version
  ON version."inputSnapshotId" = snapshot."id"
WHERE snapshot."orderId" = '<ORDER_ID_TEST>'
ORDER BY snapshot."revision";
```

## Vérification Memory Bank

Après validation du parcours avec les flags à `false`, activer progressivement selon la procédure mémoire existante.

Pendant la génération V2, contrôler dans les logs techniques que les `sourceVersionId` de la commande corrigée sont exclus. Les mémoires provenant d’autres commandes du même utilisateur doivent rester disponibles.

Après scellement de V2 :

- aucun écrasement automatique des mémoires V1 ;
- les contradictions restent en attente ;
- l’expert choisit `SUPERSEDE` ou `KEEP_BOTH` ;
- la lecture ne doit jamais être annulée en cas d’indisponibilité Vertex.

## Retour arrière

Le code peut être redéployé sur la version précédente sans supprimer les nouvelles tables. La migration étant additive, laisser les tables et la colonne nullable en place est plus sûr qu’une migration destructive de rollback.

Ne jamais exécuter de `DROP TABLE`, de `DROP COLUMN`, de `prisma migrate reset` ou de `prisma db push` sur la production.
