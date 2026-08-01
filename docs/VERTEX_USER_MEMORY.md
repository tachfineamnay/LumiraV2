# Mémoire utilisateur Vertex

## Architecture et limites

PostgreSQL reste la source de vérité. `UserMemory` conserve uniquement des faits courts, assainis et traçables ; `MemorySyncJob` est une file PostgreSQL séparée. Vertex AI Agent Engine Memory Bank est une indexation secondaire, jamais une source d’autorisation, de décision métier ou de vérité factuelle.

Chaque appel Vertex est borné au parent exact `projects/.../locations/global/reasoningEngines/...` et au scope unique `{ "user_id": "<id interne Lumira>" }`. Les retours Vertex sont revalidés contre les mémoires locales `ACTIVE` avant d’être injectés dans SCRIBE. Les statuts `PENDING`, `REJECTED`, `SUPERSEDED`, `DELETED` et `SYNC_FAILED` ne sont jamais injectés.

Le Desk expose ce flux sous le dossier client. Toutes les opérations de mémoire et de job sont `ADMIN` uniquement et demandent un `clientId` : l’API vérifie l’appartenance de chaque `memoryId` et `jobId` avant toute action.

## IAM et configuration Coolify

- Activez Vertex AI API dans le projet du compte de service déjà chiffré dans le Desk.
- Créez ou identifiez un Reasoning Engine dans `global`.
- Accordez au compte de service le rôle minimal permettant create, retrieve, list, update et delete Memory Bank sur ce Reasoning Engine. Vérifiez aussi l’accès aux opérations longues.
- Ne mettez aucune clé JSON dans Coolify, Git ou les logs. Lumira réutilise le secret Desk chiffré existant.

```env
VERTEX_MEMORY_PARENT=projects/PROJECT_ID/locations/global/reasoningEngines/REASONING_ENGINE_ID
VERTEX_MEMORY_ENABLED=false
VERTEX_MEMORY_READ_ENABLED=false
VERTEX_MEMORY_WRITE_ENABLED=false
VERTEX_MEMORY_AUTO_APPROVE=false
MEMORY_WORKER_ENABLED=false
MEMORY_WORKER_POLL_MS=5000
MEMORY_WORKER_CONCURRENCY=1
MEMORY_JOB_MAX_ATTEMPTS=5
MEMORY_JOB_STALE_MS=900000
# Le scanner automatique ne récupère qu'un enqueue récent manqué.
MEMORY_RECOVERY_LOOKBACK_MS=3600000
MEMORY_RECOVERY_LIMIT=10
# Après activation de l’écriture, nombre maximum d’intentions durables convergées par tick.
MEMORY_PENDING_MUTATION_LIMIT=10
# Délai du RPC initial, puis délai séparé d'attente de l'opération longue.
VERTEX_MEMORY_REQUEST_TIMEOUT_MS=8000
VERTEX_MEMORY_LRO_TIMEOUT_MS=60000

# Deux comptes techniques dédiés, vides avant chaque diagnostic.
VERTEX_MEMORY_DIAGNOSTIC_USER_A=
VERTEX_MEMORY_DIAGNOSTIC_USER_B=
```

Toutes les bascules sont `false` par défaut. Les variables `NEXT_PUBLIC_*` ne sont pas concernées : ce service ne doit exposer ni parent, ni identifiant client, ni détail Vertex au navigateur.

## Migration et déploiement

Les migrations versionnées `20260801000000_add_vertex_user_memory` et `20260801010000_finalize_vertex_user_memory` ajoutent les tables, index, la mission IA `MEMORY_EXTRACTION`, puis les états de convergence et l’audit de décision de conflit. Elles sont additives ; aucun contenu de lecture existant n’est transformé.

Avant un déploiement Coolify : exécuter les migrations sur une copie contrôlée, lancer `pnpm db:generate`, construire avec Node 20 et vérifier que les variables ci-dessus sont présentes sans les afficher. Ne pas activer lecture ou écriture tant que le diagnostic d’isolation et la revue Desk ne sont pas concluants.

## Activation progressive

1. Déployer avec tous les flags ci-dessus à `false`.
2. Appliquer les migrations Prisma.
3. Configurer le parent global Memory Bank et l’IAM minimal.
4. Dans le Desk, activer l’agent `MEMORY`, choisir `vertex` et un modèle, puis valider réellement `text` et `structured output`. Cette validation est obligatoire avant `MEMORY_WORKER_ENABLED=true`.
5. Activer le shadow mode (`VERTEX_MEMORY_ENABLED=true`, worker actif, lecture/écriture/auto-approbation à `false`). Tant que l’agent n’est pas prêt, le worker ne crée, ne claim ni ne modifie aucun job ; le Desk affiche le motif assaini.
6. Lancer explicitement un backfill `dryRun=true`, limité et expliqué.
7. Approuver quelques mémoires dans le Desk. Un conflit potentiel impose « remplacer » ou « conserver les deux » avec confirmation ; la décision est auditée.
8. En shadow mode, revoir explicitement les mémoires `PENDING`, notamment celles approuvées avec l’état `write_disabled`.
9. Activer `VERTEX_MEMORY_WRITE_ENABLED=true` pour l’écriture contrôlée. À chaque tick, le worker converge alors au plus `MEMORY_PENDING_MUTATION_LIMIT` intentions `UPSERT`, `DELETE` ou `SUPERSEDE`, de la plus ancienne à la plus récente.
10. Lancer le diagnostic A/B réel avec les deux comptes techniques vides.
11. Activer `VERTEX_MEMORY_READ_ENABLED=true` pour un compte test. SCRIBE reçoit au plus 8 faits locaux `ACTIVE` et déjà convergés, ordonnés par pertinence Vertex quand disponible, dans un bloc secondaire de 5 000 caractères maximum.
12. Envisager l’auto-approbation seulement après revue des faux positifs (seuil actuel 0,8) et augmenter la concurrence uniquement après observation des quotas.

SCRIBE est fail-open : une erreur PostgreSQL, une mauvaise configuration Vertex, un timeout ou une erreur de retrieval produit `memoryContext=''`. Aucun retry synchrone, statut de commande, contenu scellé, PDF, audio ou e-mail n’est modifié. Les logs ne contiennent que la classe technique de l’erreur.

## Backfill et récupération

`POST /api/expert/memories/backfill` est réservé à `ADMIN`. Le body est vide par défaut : `dryRun=true`, `limit=10`. Il accepte facultativement `userId` ou `orderId`. Son historique est volontairement manuel : aucun démarrage du worker ne le déclenche. Un backfill non dry-run exige l’agent MEMORY prêt et ne contacte jamais Vertex directement.

Le worker ne scanne que les versions `SEALED` sans job dont `sealedAt >= now - MEMORY_RECOVERY_LOOKBACK_MS`, avec `MEMORY_RECOVERY_LIMIT`. Il sert uniquement à récupérer un enqueue récent manqué, jamais à rejouer l’historique. Après les jobs de lecture, et seulement si l’écriture Vertex est active et que MEMORY est prêt, il converge au plus `MEMORY_PENDING_MUTATION_LIMIT` intentions persistées (`UPSERT`, `DELETE`, `SUPERSEDE`) dans l’ordre de leur ancienneté. Il reprend les jobs `RUNNING` dont heartbeat est expiré avec une mise à jour atomique : un seul worker peut gagner le claim. Les erreurs temporaires (`RESOURCE_EXHAUSTED`, `DEADLINE_EXCEEDED`, `UNAVAILABLE`) reçoivent un backoff exponentiel. Les erreurs d’autorisation, credentials, parent, contenu ou argument sont terminales (`CANCELLED`) et ne sont jamais reprises automatiquement. Un ADMIN peut relancer manuellement un job `FAILED` ou `CANCELLED` depuis le client concerné.

## Conflits, validation et assainissement

L’extraction peut créer des candidats `PENDING`. L’ADMIN peut approuver, corriger, rejeter, supprimer ou resynchroniser un fait. Chaque mutation enregistre d’abord une intention durable `UPSERT`, `DELETE` ou `SUPERSEDE`, puis appelle Vertex, puis finalise PostgreSQL. Si Vertex réussit alors que PostgreSQL échoue, l’intention et la référence Vertex restent visibles et une resynchronisation converge sans faux succès. `NOT_FOUND` est idempotent pour DELETE.

Chaque création Vertex porte un `memoryId` déterministe `lumira-<sha256(UserMemory.id)>`, sans contenu ni identifiant client. Le timeout RPC (`VERTEX_MEMORY_REQUEST_TIMEOUT_MS`) borne l’appel initial ; `VERTEX_MEMORY_LRO_TIMEOUT_MS` borne séparément l’attente de l’opération longue. Après timeout ambigu, un retry retrouve la même ressource avec `ALREADY_EXISTS` au lieu d’en créer une seconde.

Le sanitizer refuse notamment PII, e-mails, téléphones, URL y compris `www`, dates de naissance, identifiants longs, données médicales/sexuelles/bancaires, clés/tokens, noms de tiers explicites, injections FR/EN/ES et prédictions certaines. Les faits vagues, longs ou hors catégories autorisées sont ignorés. Les garde-fous sont défensifs : la validation humaine reste la norme.

## Diagnostic d’isolation A/B

Après avoir configuré deux comptes techniques vides et distincts, l’ADMIN lance `POST /api/expert/memories/diagnostic`. Le diagnostic refuse tout ID correspondant à un vrai `User`, vérifie les scopes A, B et la variante de casse de A vides, crée dans A, récupère dans A, vérifie l’absence depuis B et la variante de casse, puis supprime dans un `finally` et re-liste A pour confirmer le nettoyage. Il ne crée aucune ligne locale durable. N’utilisez jamais un compte client réel.

## Purge et rollback

Une purge client identifie d’abord toutes les références locales Vertex, y compris celles déjà `DELETED`, `REJECTED`, `SUPERSEDED` ou en convergence. Avec écriture activée, elle supprime puis re-liste le scope Vertex avant toute suppression S3, puis supprime les objets S3, puis marque la mémoire locale `DELETED` dans la transaction de suppression PostgreSQL. Chaque suppression nominative relit et vérifie le scope utilisateur exact avant son RPC ; `NOT_FOUND` est un succès idempotent. Une référence locale Vertex sans configuration ou avec écriture désactivée bloque la purge ; un compte ancien sans trace mémoire reste supprimable. Une erreur Vertex laisse S3 et PostgreSQL intacts.

Pour arrêter la fonctionnalité, basculer `VERTEX_MEMORY_ENABLED=false` et `MEMORY_WORKER_ENABLED=false`, puis redéployer. Les lignes et jobs locaux ne sont pas supprimés par ce rollback ; aucun nouvel appel Vertex ni contexte SCRIBE n’est alors produit. Pour réactiver, reprendre par shadow mode et relancer un backfill dry-run.

## Validation avant GO

Exécuter au minimum :

```bash
pnpm db:generate
pnpm --filter api typecheck
pnpm --filter api run test -- services/memory/*.spec.ts modules/expert/expert.controller.memory.spec.ts modules/expert/client-purge.service.spec.ts --runInBand
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git diff --check
git status --short
```

Les tests locaux utilisent des mocks Vertex et ne prouvent ni IAM réel, ni quotas, ni opérations longues Google, ni la configuration Coolify. Le GO production exige le diagnostic A/B réel, la vérification IAM sans afficher de secret, un backfill dry-run vide ou expliqué, et une purge de compte technique vérifiée. Sans ces preuves externes, la décision reste NO-GO ou GO conditionnel.
