-- Production hardening for the single-admin OpenAI-only Lumira V1 launch.

-- 1. The unique Desk account used by the founder must own ADMIN permissions.
UPDATE "Expert"
SET "role" = 'ADMIN', "isActive" = true
WHERE lower("email") = 'expert@oraclelumira.com';

-- Disable the obsolete seeded administrator so there is a single active admin identity.
UPDATE "Expert"
SET "isActive" = false
WHERE lower("email") = 'admin@oraclelumira.com';

-- 2. Legacy product/mission routing must not influence OpenAI-only V1.
UPDATE "AiRoutingRule"
SET "isActive" = false
WHERE "isActive" = true;

-- 3. Keep only the newest active row for every prompt key before enforcing uniqueness.
WITH ranked_active AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "key"
      ORDER BY "version" DESC, "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "PromptVersion"
  WHERE "isActive" = true
)
UPDATE "PromptVersion" AS prompt
SET "isActive" = false
FROM ranked_active
WHERE prompt."id" = ranked_active."id"
  AND ranked_active.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_one_active_per_key"
ON "PromptVersion" ("key")
WHERE "isActive" = true;

-- 4. Make the production model configuration explicit and deterministic.
UPDATE "PromptVersion"
SET "isActive" = false
WHERE "key" = 'MODEL_CONFIG'
  AND "isActive" = true;

INSERT INTO "PromptVersion" (
  "id",
  "key",
  "version",
  "value",
  "changedBy",
  "comment",
  "isActive",
  "createdAt"
)
VALUES (
  'prod-model-config-' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
  'MODEL_CONFIG',
  COALESCE((SELECT max("version") + 1 FROM "PromptVersion" WHERE "key" = 'MODEL_CONFIG'), 1),
  '{
    "providerMode": "openai_only",
    "agents": {
      "SCRIBE": {
        "enabled": true,
        "provider": "openai",
        "model": "gpt-5.5",
        "reasoningEffort": "high",
        "verbosity": "high",
        "maxOutputTokens": 24000
      },
      "EDITOR": {
        "enabled": true,
        "provider": "openai",
        "model": "gpt-5.4",
        "reasoningEffort": "medium",
        "verbosity": "high",
        "maxOutputTokens": 16000
      },
      "GUIDE": {
        "enabled": true,
        "provider": "openai",
        "model": "gpt-5.4",
        "reasoningEffort": "low",
        "verbosity": "medium",
        "maxOutputTokens": 6000
      },
      "NARRATOR": {
        "enabled": true,
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.3,
        "topP": 0.9,
        "maxOutputTokens": 12000
      },
      "CONFIDANT": {
        "enabled": false,
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.6,
        "topP": 0.9,
        "maxOutputTokens": 1600
      },
      "ONIRIQUE": {
        "enabled": false,
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.65,
        "topP": 0.9,
        "maxOutputTokens": 2500
      }
    }
  }',
  'production-migration',
  'OpenAI-only V1 production baseline',
  true,
  CURRENT_TIMESTAMP
);

-- 5. Replace the obsolete seven-day GUIDE instruction with the actual 30-day batch contract.
UPDATE "PromptVersion"
SET "isActive" = false
WHERE "key" = 'GUIDE'
  AND "isActive" = true;

INSERT INTO "PromptVersion" (
  "id",
  "key",
  "version",
  "value",
  "changedBy",
  "comment",
  "isActive",
  "createdAt"
)
VALUES (
  'prod-guide-prompt-' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
  'GUIDE',
  COALESCE((SELECT max("version") + 1 FROM "PromptVersion" WHERE "key" = 'GUIDE'), 1),
  'MISSION GUIDE:
Tu transformes exclusivement la synthèse validée du SCRIBE en parcours pratique de 30 jours.
Le runtime t appelle par batches de 10 jours. Tu dois produire exactement les jours demandés dans le prompt utilisateur, sans inventer une nouvelle lecture ni modifier le diagnostic symbolique.

FORMAT DE SORTIE JSON STRICT:
{
  "timeline": [
    {
      "day": 1,
      "title": "Titre précis",
      "action": "Action concrète, simple et personnalisée",
      "mantra": "Mantra personnel",
      "actionType": "MEDITATION"
    }
  ]
}

TYPES AUTORISÉS:
MEDITATION, RITUAL, JOURNALING, MANTRA, REFLECTION.

RÈGLES:
- Génère exactement le nombre de jours et les numéros demandés par le prompt utilisateur.
- Progression cohérente entre ouverture, expérimentation et intégration.
- Aucun actionType identique deux jours consécutifs.
- Aucune nouvelle interprétation, prédiction, promesse de guérison ou affirmation médicale.
- Actions réalisables, courtes et directement reliées à l archétype et au blocage transmis.
- Réponds uniquement avec le JSON attendu.',
  'production-migration',
  'Align GUIDE with the 30-day runtime contract',
  true,
  CURRENT_TIMESTAMP
);
