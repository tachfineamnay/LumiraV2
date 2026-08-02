# Déploiement manuel — demandes de complément de lecture

Ce chantier ajoute un parcours ciblé permettant à un expert de demander une photo de paume après livraison, sans modifier le dossier initial ni supprimer les versions, PDF, audios ou livraisons existantes.

## Invariants à préserver

- `ReadingIntake` scellé : jamais modifié.
- `ReadingVersion` V1, `DeliveryRecord`, PDF et audio historiques : jamais supprimés.
- La nouvelle paume est un objet S3 privé distinct.
- La V2 utilise un `ReadingInputSnapshot` immuable.
- Les mémoires issues de la commande corrigée sont exclues du contexte pendant la génération V2.
- Une photo transmise avant l’échéance reste vérifiable après l’échéance.
- Un seul lancement V2 peut être réclamé à la fois.

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
pnpm --filter web typecheck
pnpm --filter api build
pnpm --filter web build
```

La commande `db:prepare-schema` génère `packages/database/prisma/schema.runtime.prisma`. Ce fichier est volontairement ignoré par Git et rassemble le schéma historique avec les modèles additifs du chantier.

## Migration de production

Appliquer la migration avant de démarrer la nouvelle API :

```bash
pnpm --filter @packages/database db:migrate:deploy
```

La migration `20260802123000_add_reading_intake_amendments` est additive :

- création de `ReadingIntakeAmendment` ;
- création de `ReadingInputSnapshot` ;
- ajout nullable de `ReadingVersion.inputSnapshotId` ;
- ajout d’index et de contraintes ;
- aucune suppression, aucun backfill et aucune réécriture historique.

Vérifications SQL après migration :

```sql
SELECT to_regclass('public."ReadingIntakeAmendment"');
SELECT to_regclass('public."ReadingInputSnapshot"');
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'ReadingVersion'
  AND column_name = 'inputSnapshotId';

SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "ReadingVersion";
SELECT COUNT(*) FROM "DeliveryRecord";
```

Comparer les trois derniers compteurs avec les valeurs prises avant migration.

## Ordre de redéploiement

1. Sauvegarde PostgreSQL.
2. Migration additive.
3. Redéploiement API.
4. Vérification `/api/health` et logs de démarrage.
5. Redéploiement web.
6. Smoke test complet avec un compte de test.
7. Activation éventuelle de la Memory Bank dans un second temps seulement.

## Smoke test manuel obligatoire

Utiliser une commande de test livrée ou une copie anonymisée d’un parcours équivalent.

1. Ouvrir la commande dans le Desk.
2. Cliquer sur **Demander une photo de la paume**.
3. Vérifier la notification Sanctuaire et l’email unique.
4. Ouvrir le Sanctuaire sur iPhone ou Android.
5. Tester séparément **Appareil photo** et **Galerie**.
6. Tester un fichier trop lourd et un format non autorisé.
7. Enregistrer un brouillon, recharger la page et reprendre.
8. Transmettre la photo.
9. Attendre ou dépasser artificiellement l’échéance : la photo `SUBMITTED` doit rester disponible dans le Desk.
10. Vérifier que l’expert voit exactement l’objet transmis, via la route liée à la commande et au complément.
11. Demander une reprise, puis transmettre une deuxième photo.
12. Approuver la photo.
13. Vérifier la présence d’un `ReadingInputSnapshot` et l’absence de modification du `ReadingIntake` initial.
14. Double-cliquer volontairement sur **Créer une version révisée** : un seul lancement doit être accepté.
15. Vérifier que la V1, son PDF, son audio et ses `DeliveryRecord` restent présents.
16. Vérifier que la génération utilise la nouvelle paume et crée une version enfant.
17. Simuler un échec de génération : le verrou doit être libéré et V1 doit rester livrée.
18. Sceller V2, produire le nouveau PDF/audio et effectuer une nouvelle livraison.

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
