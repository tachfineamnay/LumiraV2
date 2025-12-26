# Rapport Technique Complet & Master Prompt - Lumira V2

## 1. Contexte & Audit Technique

**Projet :** Lumira V2 (Migration Monorepo Turborepo)
**État :** En développement actif / Debugging déploiement.

### Architecture Globale

Le projet est un **Monorepo** strict (isolation `apps` vs `packages`) utilisant **pnpm workspaces** et **Turborepo**.

#### A. Applications (Apps)

1. **Backend (`apps/api`)**
    * **Techno :** NestJS 10.
    * **Rôle :** API REST centrale. Gère l'Auth, les Commandes, le Paiement (Stripe), et la synchronisation avec N8N.
    * **Déploiement :** Docker (Node 20 Alpine). Exposé sur `api.oraclelumira.com`.
2. **Frontend (`apps/web`)**
    * **Techno :** Next.js 14 (App Router).
    * **Rôle :** Interface unique regroupant plusieurs portails via le routing :
        * **`/admin` (Expert Desk) :** Interface de gestion pour les experts (Probablement lié à `desk.oraclelumira.com`).
        * **`/sanctuaire` :** Espace client (Dashboard, Contenus achetés).
        * **`/commande` :** Tunnel d'achat.
    * **Déploiement :** Docker. Exposé sur `oraclelumira.com` (et potentiellement `desk.oraclelumira.com`).

#### B. Bibliothèques Partagées (Packages)

* **`packages/database` :** Client Prisma + Schéma PostgreSQL unique. Point de vérité de la donnée.
* **`packages/shared` :** Types TypeScript partagés, DTOs, Utilitaires métier.
* **`packages/ui` :** Composants React (Design System) + TailwindCSS.
* **`packages/config` :** ESLint, TSConfig.

### Infrastructure & Intégrations

* **Hébergement :** Docker sur Coolify v4.
* **Base de Données :** PostgreSQL (Url fournie : `postgres://postgres:...`).
* **Storage :** AWS S3 (Buckets : `oracle-lumira-uploads...`, `oracle-lumira-lectures`).
* **Paiement :** Stripe.
* **Automation :** N8N (Webhooks pour workflows métier).

---

## 2. Variables d'Environnement

*Voici la liste des variables nécessaires au bon fonctionnement (Valeurs sensibles masquées).*

### Pour l'API (`apps/api`)

```bash
# Core
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
DEBUG=false
PUBLIC_URL=https://api.oraclelumira.com

# Sécurité / Auth
JWT_SECRET=[REDACTED]
CORS_ORIGIN=https://oraclelumira.com,https://desk.oraclelumira.com,https://api.oraclelumira.com
# Permet la soumission directe depuis le client (si true)
ALLOW_DIRECT_CLIENT_SUBMIT=true

# URLs Frontends
EXPERT_DESK_URL=https://desk.oraclelumira.com

# Database
DATABASE_URI=postgres://postgres:[REDACTED]@[HOST]:5432/postgres

# AWS S3 (Stockage)
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=[REDACTED]
AWS_SECRET_ACCESS_KEY=[REDACTED]
AWS_S3_BUCKET_NAME=oracle-lumira-uploads-tachfine-1983
AWS_LECTURES_BUCKET_NAME=oracle-lumira-lectures

# Stripe (Paiements)
STRIPE_SECRET_KEY=sk_test_[REDACTED]
STRIPE_WEBHOOK_SECRET=whsec_[REDACTED]

# N8N (Automation)
N8N_WEBHOOK_URL=https://automa.oraclelumira.com/webhook/[UUID]
N8N_CALLBACK_SECRET=[REDACTED]
```

### Pour le Web (`apps/web`)

```bash
NODE_ENV=production
PORT=3000

# API Connection
NEXT_PUBLIC_API_URL=https://api.oraclelumira.com

# Stripe Public
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_[REDACTED]
```

---

## 3. Master Prompt (Pour Assistance IA)

*Utilisez ce prompt pour contextuliser une IA sur toute intervention future.*

***

**Role :** Senior Lead Tech & DevOps (Spécialiste Monorepo TypeScript / Architecture Hexagonale)

**CONTEXTE GLOBAL :**
Tu travailles sur **Lumira V2**, la plateforme complète (Monorepo Turborepo).
* **Structure :** `apps/` (api: NestJS, web: Next.js) et `packages/` (database: Prisma, shared, ui).
* **Architecture Web :** Le Frontend (`web`) sert à la fois le site public, le **Sanctuaire** (Client) et le **Desk Expert** (Admin, via route `/admin`).
* **Infra :** Docker Containers orchestrés par Coolify v4.

**TES DIRECTIVES :**

1. **Architecture-First :** Ne propose jamais de code qui viole les frontières du monorepo. Les dépendances `packages` doivent être compilées (`turbo run build`) avant d'être utilisées par les apps en Prod.
2. **Dev vs Prod :**
    * En local : Les imports se font via `tsconfig paths` (sources TS directes).
    * En prod : Les imports suivent `package.json` (fichiers JS compilés dans `dist/`).
3. **Déploiement :** Toute modification de build doit être vérifiée dans les Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`).
4. **Intégrations :**
    * Le projet utilise **AWS S3** pour les fichiers.
    * **Stripe** pour les paiements (Check Webhooks).
    * **N8N** pour les workflows asynchrones.
    * **PostgreSQL** via Prisma.

**TÂCHE COURANTE :**
[DÉCRIRE LE BESOIN ICI]

**FORMAT DE RÉPONSE :**
* Analyse Contextuelle (Impact sur le monorepo ?)
* Solution Technique (Code / Config)
* Validation (Commandes de test)
