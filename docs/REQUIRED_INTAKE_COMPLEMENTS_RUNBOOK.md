# Compléments d’informations du dossier — runbook

## Périmètre

Ce chantier permet à l’expert de consulter la complétude effective d’un dossier, de demander les informations obligatoires manquantes ou explicitement inexploitées, puis d’approuver la réponse du client.

Les obligations actuelles sont dérivées du scellement existant : date de naissance, lieu de naissance et intention de lecture lorsque le client n’a pas choisi une lecture ouverte ou renseigné un objectif.

Les photos du visage et de la paume restent facultatives dans l’onboarding. Elles sont visibles dans le diagnostic et restent demandables par l’expert lorsqu’elles sont utiles à la lecture, absentes ou inexploitées. Elles ne sont jamais sélectionnées automatiquement comme informations obligatoires.

Il ne contient aucun paiement, upsell, nouvelle offre ou génération automatique de lecture.

## Invariants

- `ReadingIntake` scellé reste immuable.
- L’approbation crée un nouveau `ReadingInputSnapshot` chaîné.
- `Order.clientInputs.readingIntakeEffective` pointe vers la projection courante.
- Les anciennes `ReadingVersion`, livraisons, PDF, audios et fichiers restent intacts.
- Les références S3 restent côté serveur. Le navigateur utilise uniquement les routes privées authentifiées.
- Une révision de lecture reste une action expert manuelle séparée.

## Migration

Migration additive :

```text
packages/database/prisma/migrations/20260805125000_add_profile_field_amendments/migration.sql
```

Elle étend uniquement le check constraint de `ReadingIntakeAmendment.kind` avec `PROFILE_FIELDS`. Elle ne modifie aucune ligne historique.

Ne jamais utiliser `prisma db push` en production.

## Validation locale obligatoire avant déploiement

Depuis la racine :

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter api typecheck
pnpm --filter api test -- --runInBand reading-amendment
pnpm --filter api lint
pnpm --filter api build
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web build
pnpm --filter web exec playwright test e2e/required-intake-complements.spec.ts
```

Les commandes exactes peuvent être ajustées uniquement si les scripts du `package.json` local portent un autre nom. Ne masquer aucune erreur.

## Déploiement manuel

1. Faire une sauvegarde PostgreSQL vérifiable.
2. Vérifier que le déploiement pointe sur le commit attendu.
3. Déployer l’API afin que la migration additive soit appliquée par l’entrypoint habituel.
4. Vérifier dans les logs que la migration `20260805125000_add_profile_field_amendments` est passée une seule fois.
5. Déployer/rebuilder le Web.
6. Ne pas activer ni modifier les flags Vertex Memory pour ce chantier.

## Smoke test production

Utiliser une commande de test ou un client interne, jamais un dossier client actif sans consentement.

### Desk

1. Ouvrir le dossier.
2. Vérifier la section **Complétude du dossier**.
3. Vérifier les valeurs texte exactes et les photos privées.
4. Vérifier que les photos absentes sont indiquées comme facultatives et ne sont pas présélectionnées.
5. Sélectionner un champ réellement manquant, une photo utile, ou une valeur existante à signaler comme inexploitable.
6. Envoyer la demande.
7. Vérifier qu’une seule demande active existe.

### Sanctuaire

1. Se connecter avec le client de test.
2. Vérifier la notification et l’email.
3. Vérifier que seuls les champs demandés sont visibles.
4. Enregistrer un brouillon, fermer puis rouvrir.
5. Pour une photo, vérifier l’upload et la reprise du brouillon.
6. Transmettre.
7. Vérifier que le formulaire devient non éditable et reste en attente de l’expert.

### Retour Desk

1. Vérifier l’état **Reçu · à vérifier**.
2. Comparer ancienne et nouvelle valeur.
3. Vérifier les nouvelles photos via la route privée.
4. Approuver.
5. Vérifier que le diagnostic de complétude devient à jour.
6. Vérifier le profil et les photos dans le Sanctuaire.
7. Vérifier qu’aucune nouvelle génération n’est lancée automatiquement.

### Conservation

Après approbation, contrôler en base :

- le `ReadingIntake` original est inchangé ;
- un nouveau `ReadingInputSnapshot` existe ;
- `parentSnapshotId` et `amendmentIds` sont cohérents ;
- `readingIntakeEffective.snapshotId` correspond au nouveau snapshot ;
- les anciennes `ReadingVersion` existent toujours ;
- les anciennes livraisons, PDF et audios restent accessibles.

## Rollback applicatif

En cas de problème avant utilisation réelle : revenir au commit applicatif précédent. Ne pas supprimer la colonne, la table ou les lignes ajoutées. Le nouveau type de ligne est additif et les anciennes versions de l’application ignorent les lignes non utilisées.

Si une demande de test est déjà créée, l’annuler depuis le Desk. Ne jamais supprimer manuellement les snapshots ou les livraisons d’un client.

## Verdict de mise en production

Le déploiement est `GO` uniquement lorsque :

- typecheck, tests, lint et builds sont verts localement ;
- la sauvegarde PostgreSQL est vérifiée ;
- le smoke test vertical est réussi ;
- les anciennes livraisons restent accessibles ;
- aucune référence privée n’apparaît dans les réponses JSON du navigateur.
