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
VERTEX_MEMORY_REQUEST_TIMEOUT_MS=8000

# Deux comptes techniques dédiés, vides avant chaque diagnostic.
VERTEX_MEMORY_DIAGNOSTIC_USER_A=
VERTEX_MEMORY_DIAGNOSTIC_USER_B=
```

Toutes les bascules sont `false` par défaut. Les variables `NEXT_PUBLIC_*` ne sont pas concernées : ce service ne doit exposer ni parent, ni identifiant client, ni détail Vertex au navigateur.

## Migration et déploiement

La migration versionnée `20260801000000_add_vertex_user_memory` ajoute les enums, les tables, les index et la mission IA `MEMORY_EXTRACTION`. Elle est additive ; aucun contenu de lecture existant n’est transformé.

Avant un déploiement Coolify : exécuter les migrations sur une copie contrôlée, lancer `pnpm db:generate`, construire avec Node 20 et vérifier que les variables ci-dessus sont présentes sans les afficher. Ne pas activer lecture ou écriture tant que le diagnostic d’isolation et la revue Desk ne sont pas concluants.

## Activation progressive

1. Shadow : `VERTEX_MEMORY_ENABLED=true` et worker actif, lecture/écriture/auto-approbation à `false`. Les jobs extraient et assainissent localement, sans Vertex.
2. Écriture contrôlée : activer `VERTEX_MEMORY_WRITE_ENABLED=true`, laisser l’auto-approbation à `false` et examiner les candidats `PENDING` dans le Desk.
3. Lecture contrôlée : activer `VERTEX_MEMORY_READ_ENABLED=true`. SCRIBE reçoit au plus 8 faits locaux `ACTIVE`, ordonnés par pertinence Vertex quand disponible, dans un bloc secondaire de 5 000 caractères maximum.
4. Auto-approbation : uniquement après revue des faux positifs, avec seuil de confiance actuel de 0,8. Augmenter la concurrence seulement après observation des jobs et des quotas.

SCRIBE est fail-open : une erreur PostgreSQL, une mauvaise configuration Vertex, un timeout ou une erreur de retrieval produit `memoryContext=''`. Aucun retry synchrone, statut de commande, contenu scellé, PDF, audio ou e-mail n’est modifié. Les logs ne contiennent que la classe technique de l’erreur.

## Backfill et récupération

`POST /api/expert/memories/backfill` est réservé à `ADMIN`. Le body est vide par défaut : `dryRun=true`, `limit=10`. Il accepte facultativement `userId` ou `orderId`. Il ne sélectionne que des `ReadingVersion` `SEALED` sans job, crée seulement les jobs manquants et ne contacte jamais Vertex directement.

Le worker exécute le même scan borné lorsque la mémoire et le worker sont activés. Il reprend les jobs `RUNNING` dont heartbeat est expiré avec une mise à jour atomique : un seul worker peut gagner le claim. Les erreurs temporaires (`RESOURCE_EXHAUSTED`, `DEADLINE_EXCEEDED`, `UNAVAILABLE`) reçoivent un backoff exponentiel. Les erreurs d’autorisation, credentials, parent, contenu ou argument sont terminales (`CANCELLED`) et ne sont jamais reprises automatiquement. Un ADMIN peut relancer manuellement un job `FAILED` ou `CANCELLED` depuis le client concerné.

## Conflits, validation et assainissement

L’extraction peut créer des candidats `PENDING`. L’ADMIN peut approuver, corriger, rejeter, supprimer ou resynchroniser un fait. Un rejet ou une suppression efface d’abord la copie Vertex puis change le statut local. Une correction est repassée par le sanitizer, produit un nouveau hash et peut marquer explicitement une autre mémoire du même client `SUPERSEDED` après suppression distante.

Le sanitizer refuse notamment PII, e-mails, téléphones, URL y compris `www`, dates de naissance, identifiants longs, données médicales/sexuelles/bancaires, clés/tokens, noms de tiers explicites, injections FR/EN/ES et prédictions certaines. Les faits vagues, longs ou hors catégories autorisées sont ignorés. Les garde-fous sont défensifs : la validation humaine reste la norme.

## Diagnostic d’isolation A/B

Après avoir configuré deux comptes techniques vides, l’ADMIN lance `POST /api/expert/memories/diagnostic`. Le diagnostic crée un fait temporaire dans A, le retrouve dans A, vérifie qu’il est absent de B et que l’accès hors scope est rejeté par les contrôles de scope, puis le supprime et re-liste A pour confirmer le nettoyage. Il ne crée aucune ligne locale durable et refuse de s’exécuter si les comptes techniques ne sont pas vides. N’utilisez jamais un compte client réel.

## Purge et rollback

Une purge client identifie d’abord les références locales et distantes. Elle supprime et re-liste Vertex avant toute suppression S3, puis supprime les objets S3, puis marque la mémoire locale `DELETED` dans la transaction de suppression PostgreSQL. `NOT_FOUND` est un succès idempotent. Une référence locale Vertex sans configuration bloque la purge ; un compte ancien sans trace mémoire reste supprimable. Une erreur Vertex laisse S3 et PostgreSQL intacts.

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
