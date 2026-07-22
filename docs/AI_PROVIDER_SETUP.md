# Configuration des providers IA (OpenAI, Gemini API, Vertex AI)

Ce guide décrit la configuration serveur de Lumira V2 pour la couche IA.

## Architecture

```text
MODEL_CONFIG
  → AiExecutionResolverService
  → OpenAiAdapter | GeminiAdapter | VertexAdapter
  → OpenAI Responses API | Gemini Developer API | Vertex AI
```

Un seul SDK Google unifié : `@google/genai`.

- **Gemini API** (`provider: gemini`) : clé `GEMINI_API_KEY`, endpoint Developer API (`generativelanguage.googleapis.com`). Jamais de compte de service.
- **Vertex AI** (`provider: vertex`) : compte de service chiffré dans le Desk, projet + `VERTEX_LOCATION`. Jamais `GEMINI_API_KEY`.
- **OpenAI** (`provider: openai`) : `OPENAI_API_KEY`.

Aucun fallback automatique d’un provider vers un autre pendant une génération.

## Modes de routage (`MODEL_CONFIG.providerMode`)

| Mode          | Comportement                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `openai_only` | Tous les agents utilisent OpenAI. Les sélecteurs provider sont verrouillés dans le Desk.             |
| `per_agent`   | Chaque agent utilise exactement son `provider` / `model` sauvegardé. Aucun héritage `AiRoutingRule`. |

## Variables serveur

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
VERTEX_LOCATION=us-central1
SETTINGS_ENCRYPTION_KEY=
```

| Variable                  | Usage                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`          | Requis si un agent actif utilise OpenAI (ou mode `openai_only`)                                                                                             |
| `GEMINI_API_KEY`          | Requis si un agent actif utilise Gemini API                                                                                                                 |
| `VERTEX_LOCATION`         | Région Vertex unique (catalogue, diagnostics, runtime). Défaut documenté : `us-central1`. Utiliser `global` uniquement si les modèles ciblés le supportent. |
| `SETTINGS_ENCRYPTION_KEY` | Chiffrement AES-GCM du JSON compte de service Vertex stocké en base                                                                                         |

**Important :**

- Ne jamais ajouter de préfixe `NEXT_PUBLIC_` pour ces clés.
- Ne jamais committer de secrets.
- Les credentials Vertex restent dans le Desk (chiffrés), pas dans une variable publique.

## Coolify

1. Service **API** (`apps/api`) → Environment Variables.
2. Définir `OPENAI_API_KEY`, `GEMINI_API_KEY`, `VERTEX_LOCATION`, `SETTINGS_ENCRYPTION_KEY` selon les providers actifs.
3. Redémarrer le conteneur API.
4. Dans le Desk : Paramètres IA → Credentials → uploader le JSON service account Vertex si besoin → Tester.

Le frontend (`apps/web`) n’a pas besoin de ces variables.

## Distinction Gemini API / Vertex AI

|                      | Gemini API                          | Vertex AI                                  |
| -------------------- | ----------------------------------- | ------------------------------------------ |
| Auth                 | Clé AI Studio                       | Compte de service Google Cloud             |
| SDK                  | `@google/genai` (`vertexai: false`) | `@google/genai` (`vertexai: true`)         |
| Identifiants modèles | `gemini-2.5-pro`, etc.              | Mêmes IDs métier, endpoint Cloud différent |
| Région               | N/A                                 | `VERTEX_LOCATION`                          |

## Catalogues modèles (Desk)

| Libellé              | Signification                                             |
| -------------------- | --------------------------------------------------------- |
| Live vérifié         | Listé par l’API provider ∩ allowlist Lumira               |
| Supporté non vérifié | Allowlist produit uniquement (jamais présenté comme live) |
| Indisponible         | Non accessible pour le compte                             |
| Erreur de catalogue  | Listing impossible ; allowlist affichée comme supportée   |

## Tests dans le Desk

1. Paramètres IA → Connexion.
2. Vérifier configuré / source credentials / région Vertex.
3. Tester : texte, vision, JSON structuré.
4. Paramètres IA → Modèles : mode `openai_only` ou `per_agent`, provider + modèle par agent.
5. Préproduction : readiness dynamique selon les providers réellement actifs.

## Erreurs fréquentes

| Symptôme                 | Cause                             | Action                                                          |
| ------------------------ | --------------------------------- | --------------------------------------------------------------- |
| Non configurée           | Variable / credentials absents    | Coolify / Desk, redémarrer                                      |
| Clé invalide (401)       | Mauvaise clé                      | Régénérer, redémarrer                                           |
| Permission refusée (403) | Droits projet / API               | IAM + activer Vertex AI API                                     |
| Quota / facturation      | Crédit épuisé                     | Facturation OpenAI / AI Studio / GCP                            |
| Région non supportée     | `VERTEX_LOCATION` incompatible    | Aligner sur une région Gemini supportée                         |
| Modèle inaccessible      | Nom hors allowlist ou hors compte | Corriger dans Modèles + retester                                |
| JSON structuré KO        | Modèle / schema Google            | Retester structured ; ne pas modifier les schémas métier OpenAI |

Les messages Desk incluent toujours le provider et le modèle effectifs.

## Santé IA

```http
GET /api/health/ai
```

Sans secrets, sans appel payant à chaque requête. Les statuts `text` / `multimodal` reflètent le dernier test volontaire (~5 min cache).

## Sécurité

- Rotation régulière des clés.
- Logs sanitizés (`sk-…`, `AIza…`, Bearer, private keys).
- Pas de fallback opaque OpenAI → Google.

## Vérification rapide

```bash
pnpm --filter api test -- ai-provider-diagnostics ai-model-catalog ai-production-readiness
curl http://localhost:3001/api/health/ai
```
