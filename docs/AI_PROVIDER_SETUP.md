# Configuration des providers IA (Gemini & OpenAI)

Ce guide décrit comment configurer les clés API utilisées par Lumira V2 en production.

## Variables serveur requises

| Variable         | Service                 | Usage                                                              |
| ---------------- | ----------------------- | ------------------------------------------------------------------ |
| `GEMINI_API_KEY` | API NestJS (`apps/api`) | SCRIBE, GUIDE, EDITOR, CONFIDANT, ONIRIQUE, NARRATOR (mode Gemini) |
| `OPENAI_API_KEY` | API NestJS (`apps/api`) | Agents basculés sur OpenAI dans Paramètres IA                      |

**Important :**

- Ne jamais ajouter de préfixe `NEXT_PUBLIC_` pour ces clés.
- Ne jamais committer de secrets dans Git (`.env`, Coolify, etc. uniquement).
- Les clés ne sont **jamais** exposées au frontend ni dans les logs.

## Où placer les clés

### Développement local

Dans le fichier `.env` à la racine du monorepo (voir `.env.example`) :

```env
GEMINI_API_KEY="votre-clé-google-ai-studio"
OPENAI_API_KEY="votre-clé-openai-platform"
```

### Production (Coolify)

1. Ouvrir le service **API** (`apps/api`) dans Coolify.
2. Aller dans **Environment Variables**.
3. Ajouter `GEMINI_API_KEY` et/ou `OPENAI_API_KEY` avec les valeurs réelles.
4. **Redémarrer** le conteneur API après toute modification.

Le frontend (`apps/web`) n'a pas besoin de ces variables.

## Obtenir les clés

### Gemini (`GEMINI_API_KEY`)

1. [Google AI Studio](https://aistudio.google.com/apikey)
2. Créer une clé API pour le projet Google Cloud associé.
3. Vérifier que la facturation / les quotas sont actifs si vous dépassez le tier gratuit.

### OpenAI (`OPENAI_API_KEY`)

1. [OpenAI Platform](https://platform.openai.com/api-keys)
2. Créer une clé API avec accès aux modèles configurés (ex. `gpt-4o`, `gpt-4o-mini`).

**Attention :** un abonnement ChatGPT Plus **n'est pas** une clé API OpenAI. Il faut un compte sur OpenAI Platform avec facturation API activée.

## Redémarrage

Après ajout ou rotation d'une clé :

```bash
# Coolify : redémarrer le service API via l'interface
# Local :
pnpm --filter api dev   # ou redémarrer le processus en cours
```

Les variables d'environnement ne sont lues qu'au démarrage du processus API.

## Tests dans le Desk

1. Se connecter au Desk expert (admin).
2. **Paramètres IA → Credentials**.
3. Vérifier le badge (Configurée, Non configurée, Connexion réussie, etc.).
4. Cliquer **Tester la connexion** ou **Retester**.
5. Contrôler :
   - le modèle testé (depuis l'onglet **Modèles**) ;
   - la date du dernier test ;
   - le statut multimodal Gemini (si applicable).

Les tests appellent réellement l'API avec un prompt minimal et une limite de tokens faible (timeout ~20 s).

## Endpoint de santé IA

Sans authentification, sans secrets, **sans appel payant** à chaque requête :

```http
GET /api/health/ai
```

Réponse exemple :

```json
{
  "gemini": {
    "configured": true,
    "text": "ok",
    "multimodal": "ok",
    "model": "gemini-2.5-flash"
  },
  "openai": {
    "configured": false,
    "text": "not_tested",
    "model": "gpt-4o-mini"
  }
}
```

Les champs `text` / `multimodal` reflètent le **dernier test volontaire** (Desk ou script), mis en cache ~5 minutes. Tant qu'aucun test n'a été lancé, la valeur est `not_tested`.

## Erreurs fréquentes

| Symptôme                     | Cause probable               | Action                                                  |
| ---------------------------- | ---------------------------- | ------------------------------------------------------- |
| Non configurée               | Variable absente ou vide     | Ajouter la clé dans Coolify / `.env`, redémarrer l'API  |
| Clé API invalide (401)       | Clé erronée ou révoquée      | Regénérer la clé, mettre à jour l'env, redémarrer       |
| Permission refusée (403)     | Clé sans accès au modèle     | Vérifier les droits du projet / activer l'API           |
| Quota ou facturation absente | Pas de crédit / quota épuisé | Activer la facturation Google AI Studio ou OpenAI       |
| Limite 429                   | Trop de requêtes             | Attendre, réduire la fréquence des tests                |
| Modèle inaccessible          | Nom de modèle incorrect      | Corriger dans Paramètres IA → Modèles                   |
| Délai dépassé                | Réseau ou API lente          | Retester ; vérifier la connectivité sortante du serveur |

## Sécurité

- Rotation régulière des clés en production.
- Ne pas partager les clés dans Slack, e-mail ou tickets.
- Les réponses API et logs serveur masquent les patterns de clés (`AIza…`, `sk-…`).
- OpenAI et Gemini sont configurés **uniquement** côté serveur (`VertexOracle`, `AudioScriptService`, etc.).

## Vérification rapide en local

```bash
pnpm --filter api test -- ai-provider-diagnostics
curl http://localhost:3001/api/health/ai
```
