# MASTER AUDIT - ORACLE LUMIRA V2

**Status:** CONFIDENTIAL / INTERNAL
**Date:** 22 Janvier 2026
**Scope:** Inventaire Exhaustif (Frontend, Backend, Data, Integrations)

---

## 🏗️ 1. CARTOGRAPHIE FRONTEND (WEB)

### Application Structure (`apps/web`)

Le frontend est une **Mono-App Next.js 14** divisée en 3 zones distinctes (Sphères).

#### A. Le Sanctuaire (Espace Client) - `/sanctuaire`

L'espace personnel de l'utilisateur, gamifié et progressif.

* **Dashboard (`/sanctuaire`)** : Point d'entrée principal.
  * *Composants*: `MandalaNav` (Navigation circulaire), `OracleOnboardingChat` (Chatbot d'accueil), `CosmicNotification` (État des commandes).
  * *Features*: Auto-login par lien email, déblocage progressif des modules selon le niveau d'achat (Initié -> Intégral).
* **Profil (`/sanctuaire/profile`)** : Gestion des données de naissance.
  * *Data*: Date/Heure/Lieu, Photos (Visage/Paume).
* **Lectures (`/sanctuaire/draws`)** : Historique des PDF générés.
* **Synthèse (`/sanctuaire/synthesis`)** : La "Bible" de l'utilisateur.
  * *Data*: Archétype, Mission de Vie, Blocages Karmiques.
* **Chat Mentor (`/sanctuaire/chat`)** : Interface de discussion avec l'IA "Mentor".
* **Mandala (`/sanctuaire/mandala`)** : Visualisation HD du Mandala personnel.

#### B. Expert Desk (Espace Admin) - `/admin`

L'outil de travail des "Experts" et Administrateurs. Accessble via `desk.oraclelumira.com`.

* **Workspace (`/admin/workspace`)** : Le cockpit de production.
  * *Feature*: `CreationEngine` (Machine à état pour la génération de lecture).
* **Clients (`/admin/clients`)** : CRM léger. Liste des utilisateurs et historique.
* **Orders (`/admin/orders`)** : Gestion des commandes (Queue de validation, Assignation).
* **Settings (`/admin/settings`)** : Configuration dynamique (Clés API Vertex, Prompts).

#### C. Boutique & Landing (Public)

* **Vitrines** : Pages de vente pour les 4 niveaux de produits.
* **Tunnel (`/commande`)** : Checkout Stripe optimisé.

---

## 🔌 2. CARTOGRAPHIE BACKEND (API)

### Endpoints (REST)

L'API NestJS expose les routes suivantes, sécurisées par `JwtAuthGuard` et `RolesGuard`.

#### Module `Auth`

* `POST /auth/login/client` : Connexion client classique.
* `POST /auth/login/expert` : Connexion admin/expert.
* `POST /auth/sanctuaire-v2` : **Magic Link**. Authentification sans mot de passe via email (Rate-limited).

#### Module `Orders`

* `POST /orders` : Création de commande (Stripe Webhook ou App).
* `GET /orders` : Liste des commandes (filtrée par rôle).
* `PATCH /orders/:id` : Mise à jour statut/contenu (Admin only).

#### Module `Expert` (Le Cerveau)

* `GET /expert/orders/pending` : File d'attente des commandes à traiter.
* `POST /expert/orders/:id/generate` : **Trigger IA**. Lance la génération (DigitalSoulService).
* `POST /expert/orders/:id/assign` : S'attribuer une commande.
* `POST /expert/regenerate` : Relancer une génération si insatisfaisante.
* `PUT /expert/settings/vertex-key` : Hot-swap de la clé API Google.

#### Module `Insights`

* `GET /insights` : Récupérer les 8 catégories d'insights.
* `POST /webhooks/n8n/insights` : Endpoint sécurisé (API Key) pour recevoir des insights générés par n8n.

---

## 💾 3. CARTOGRAPHIE DATA (PRISMA)

### Modèles Critiques

1. **`Order` (Le Pivot)**
    * Centralise tout : `userId`, `stripeSessionId`, `generatedContent` (JSON), `status` (Enum: PENDING, PAID, PROCESSING, COMPLETED).
    * Contient les prompts experts et les logs d'erreurs IA.

2. **`User` & `UserProfile`**
    * `User` : Auth & Stripe ID.
    * `UserProfile` : Données astrologiques (Heure/Lieu naissance) & Photos biométriques.

3. **`SpiritualPath` (L'Âme Numérique)**
    * Stocke l'Archétype et la Synthèse globale.
    * Relation `1-n` avec `PathStep` (Les 30 jours du voyage initiatique).

4. **`Insight`**
    * Table unique avec contrainte `@@unique([userId, category])`.
    * Stocke le contenu "Short" et "Full" pour les 8 domaines de vie.

---

## ⚡ 4. INTÉGRATIONS & INFRASTRUCTURE

### Intelligence Artificielle (AI)

* **Google Vertex AI** : Moteur principal pour la génération des lectures (PDF).
* **n8n** : Orchestrateur secondaire pour la génération des "Insights" quotidiens/hebdomadaires (Webhook entrant).

### Paiement

* **Stripe** : Gestion complète des paiements et abonnements. Webhooks écoutés par l'API pour passer les commandes en `PAID`.

### Génération de Documents

* **Gotenberg** (Dockerisé) : Service de conversion HTML -> PDF utilisé par `PdfFactory`. Templates Handlebars.

### Stockage

* **AWS S3** : Stockage des PDF générés et des photos utilisateurs (Signés via `@aws-sdk`).

### DevOps

* **Docker Compose** : Orchestration locale et Prod.
* **Coolify** : Plateforme de déploiement (Webhook CI/CD).
* **TurboRepo** : Build system monorepo.

---

## 🎯 5. MÉTRIQUES CLÉS (KPIs TECHNIQUES)

* **Temps de Génération** : ~30-60 secondes (IA + PDF).
* **Taille Image Docker** : ~150MB (Web Standalone), ~200MB (API Optimisée).
* **Couverture Fonctionnelle** : 100% du flux (Commande -> Génération -> Livraison) est automatisé.
* **Sécurité** : 3 niveaux de Guards (JWT, Roles, API Keys internes).

*Fin du Master Audit.*
