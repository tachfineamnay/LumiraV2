# Mémoire utilisateur Vertex

La base PostgreSQL Lumira est la source de vérité. Vertex AI Agent Engine Memory Bank est uniquement une couche de continuité secondaire, limitée au parent `projects/.../locations/global/reasoningEngines/...` et au scope exact `{ "user_id": "<id interne Lumira>" }`.

## Prérequis Google Cloud

- Activez Vertex AI API pour le projet du compte de service déjà stocké chiffré dans le Desk.
- Créez ou identifiez un Reasoning Engine dans `global`, puis renseignez son nom complet dans `VERTEX_MEMORY_PARENT`.
- Accordez au compte de service le rôle minimal permettant les opérations Memory Bank sur ce Reasoning Engine. Ne créez ni deuxième variable de credentials ni fichier de clé dans Coolify.

## Variables Coolify

Toutes sont désactivées par défaut :

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
```

## Activation progressive

1. Shadow mode : activez `VERTEX_MEMORY_ENABLED=true` et `MEMORY_WORKER_ENABLED=true`; laissez lecture, écriture et auto-approbation à `false`. Les candidats de lectures scellées restent locaux en `PENDING`.
2. Écriture contrôlée : passez `VERTEX_MEMORY_WRITE_ENABLED=true`; ne passez pas `VERTEX_MEMORY_AUTO_APPROVE=true` sans revue explicite des candidats et du seuil de confiance.
3. Lecture test : activez `VERTEX_MEMORY_READ_ENABLED=true`; SCRIBE reçoit seulement un bloc secondaire borné et croisé avec les mémoires locales `ACTIVE`.
4. Production : augmentez la concurrence uniquement après observation des jobs, des erreurs normalisées et de l'isolation par utilisateur.

## Rollback et purge

Pour arrêter sans interrompre les lectures, définissez `VERTEX_MEMORY_ENABLED=false` puis `MEMORY_WORKER_ENABLED=false` et redéployez. Les jobs et mémoires locaux restent auditables mais aucun appel Vertex ni ajout au prompt SCRIBE n'est effectué.

La purge client tente d'abord la suppression Vertex, puis la suppression locale par cascade. Si la suppression distante échoue, le compte client reste intact afin que l'expert puisse relancer la purge sans perte de contrôle.
