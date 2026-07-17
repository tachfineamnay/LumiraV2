# Desk Control Center — architecture P0

## Objectif

Le Desk pilote les traitements lourds sans dépendre de la page ouverte dans le navigateur. Prendre une commande en charge reste une action d’assignation. Lancer la production crée un travail serveur durable que l’expert peut suivre depuis n’importe quelle page du Desk.

## Portée de cette tranche

Cette première tranche stabilise sans migration destructive :

- génération de lecture en arrière-plan ;
- génération audio suivie et relançable ;
- verrou transactionnel contre les doubles lancements ;
- heartbeat et reprise après redémarrage ;
- centre de production global ;
- état détaillé dans chaque Studio ;
- compatibilité avec les anciennes routes de génération.

Aucun fichier de l’expérience Sanctuaire en cours de refonte n’est modifié par cette branche.

## Persistance P0

L’état courant et les vingt derniers traitements d’une commande sont enregistrés dans `Order.expertReview` :

```json
{
  "assignedBy": "expert-id",
  "assignedName": "Expert",
  "production": {
    "id": "prod_uuid",
    "type": "READING_GENERATION",
    "status": "RUNNING",
    "stage": "GENERATING_READING",
    "attempts": 1,
    "maxAttempts": 3,
    "heartbeatAt": "2026-07-17T15:00:00.000Z"
  },
  "productionHistory": [],
  "assets": {
    "audio": { "status": "GENERATING" }
  }
}
```

Cette solution réutilise le schéma existant et évite un conflit de migration pendant le chantier Sanctuaire. Elle convient à une seule instance worker et à la phase de lancement. La cible V2 suivante reste une table `GenerationJob` dédiée, avec `ReadingAsset`, `Conversation`, `Message` et `ActivityEvent`.

## Routes canoniques

- `POST /api/expert/orders/:id/jobs/reading`
- `POST /api/expert/orders/:id/jobs/audio`
- `GET /api/expert/production/jobs`
- `GET /api/expert/production/summary`
- `GET /api/expert/orders/:id/control-center`
- `POST /api/expert/production/jobs/:jobId/retry`
- `POST /api/expert/production/jobs/:jobId/cancel`
- `POST /api/expert/production/recover-stale` — ADMIN uniquement

Les routes historiques `/expert/process-order`, `/expert/orders/:id/generate` et `/generate-full` passent par un interceptor de compatibilité. Le traitement est toujours pris en charge par le worker.

## Cycle d’un traitement

```text
QUEUED → RUNNING → SUCCEEDED
                   └→ FAILED → retry → QUEUED
QUEUED → CANCELLED
```

Étapes actuellement exposées :

- `QUEUED`
- `STARTING`
- `GENERATING_READING`
- `GENERATING_AUDIO`
- `RECOVERED_AFTER_RESTART`
- `COMPLETED`
- `FAILED`
- `STALE_MAX_ATTEMPTS`

## Reprise après redémarrage

Le worker met à jour `heartbeatAt` toutes les dix secondes. Un job `RUNNING` sans heartbeat récent est :

- replacé en `QUEUED` lorsqu’il reste des tentatives ;
- placé en `FAILED` lorsque le nombre maximal de tentatives est atteint.

Pour une lecture interrompue alors que `Order.status` est `PROCESSING`, l’ordre repasse temporairement en `FAILED`, statut accepté par le générateur pour une reprise contrôlée.

## Variables Coolify

```env
PRODUCTION_WORKER_ENABLED=true
PRODUCTION_WORKER_POLL_MS=2500
PRODUCTION_WORKER_CONCURRENCY=2
PRODUCTION_JOB_STALE_MS=900000
PRODUCTION_JOB_MAX_ATTEMPTS=3
```

### Important en cas de plusieurs réplicas API

Tant que le moteur P0 utilise `Order.expertReview`, activer le worker sur une seule réplique API. Les transactions sérialisables et la vérification du job protègent contre la majorité des doubles claims, mais la prochaine étape doit déplacer les jobs dans une table dédiée avant un déploiement horizontal important.

## Déploiement Coolify

1. sauvegarder PostgreSQL ;
2. déployer l’API ;
3. vérifier `/api/health` ;
4. vérifier dans les logs : `Production worker started` ;
5. déployer le Web/Desk ;
6. ouvrir `/admin/production` ;
7. assigner une commande de test ;
8. cliquer `Lancer la production` ;
9. changer immédiatement de page ;
10. vérifier que le job continue et rejoint `À valider` ;
11. finaliser une lecture de test ;
12. lancer ou vérifier l’audio depuis le Studio.

## Smoke tests obligatoires

- assigner ne change pas le statut en `PROCESSING` ;
- deux clics de génération ne créent pas deux travaux actifs ;
- changer de page n’arrête pas la lecture ;
- une déconnexion du navigateur n’arrête pas la lecture ;
- un redémarrage API récupère un job abandonné ;
- une erreur est visible dans `/admin/production` ;
- `Réessayer` relance uniquement l’étape échouée ;
- un audio existant n’est pas recréé sans action explicite ;
- le client ne voit jamais les erreurs techniques du worker.

## Rollback

Le rollback applicatif consiste à redéployer le commit précédent. Aucun schéma n’est ajouté dans cette tranche. Les nouvelles clés JSON présentes dans `Order.expertReview` sont ignorées par l’ancien code et peuvent rester en base.

Avant rollback, attendre la fin des jobs actifs ou les annuler depuis le Desk afin d’éviter qu’une ancienne image API ne reprenne une commande au statut intermédiaire.

## Limites ouvertes avant la version suivante

- historique limité aux commandes les plus récentes lors des recherches globales ;
- une seule tâche courante par commande ;
- pas encore de table normalisée pour les jobs et les assets ;
- la messagerie structurée Desk/Sanctuaire reste à ajouter ;
- l’audio complet doit être harmonisé avec la version scellée et le DTO client canonique ;
- le lancement audio automatique historique après PDF doit être supprimé ou redirigé vers le worker lors de la tranche suivante.
