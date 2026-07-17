# Mise en route client — Lumira V2

Ce document est le runbook de livraison de la stack Lumira V2. La cible recommandée est Coolify avec quatre ressources sur le même réseau privé : PostgreSQL, Gotenberg, API NestJS et Web Next.js.

## 1. Périmètre livré

- Web Next.js 14 : landing, checkout Stripe, Sanctuaire et Desk expert.
- API NestJS : paiement, authentification, génération, validation et livraison.
- PostgreSQL 16 avec migrations Prisma versionnées.
- Deux buckets S3 privés : contenus générés et uploads clients.
- Gotenberg pour la génération PDF.
- SMTP transactionnel pour les liens magiques et notifications.

Révision de livraison : branche `finalisation/lumira-v2-launch-ready`. Les migrations sont appliquées automatiquement au démarrage de l’API avec `prisma migrate deploy`. Une base neuve ne doit jamais être marquée manuellement comme migrée.

## 2. Ressources Coolify

Créer les services dans cet ordre :

1. PostgreSQL 16, avec volume persistant et sauvegarde quotidienne.
2. Gotenberg, image `gotenberg/gotenberg:8`, accessible uniquement sur le réseau privé.
3. API, contexte de build à la racine du dépôt et Dockerfile `apps/api/Dockerfile`.
4. Web, même contexte de build et Dockerfile `apps/web/Dockerfile`.

Domaines conseillés :

- Web : `https://oraclelumira.com`
- API : `https://api.oraclelumira.com`

Configurer `/api/health` comme healthcheck HTTP pour l’API et le Web. Le healthcheck API vérifie PostgreSQL ; celui du Web vérifie à son tour l’API.

## 3. Variables API obligatoires

| Variable | Valeur attendue |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | URL PostgreSQL privée Coolify |
| `JWT_SECRET` | secret aléatoire d’au moins 32 caractères |
| `SETTINGS_ENCRYPTION_KEY` | clé base64 représentant exactement 32 octets |
| `WEB_URL` | URL publique du Web, sans slash final |
| `STRIPE_SECRET_KEY` | clé Stripe live |
| `STRIPE_WEBHOOK_SECRET` | secret du webhook Stripe live |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | accès SMTP transactionnel |
| `MAIL_FROM` | expéditeur validé par le fournisseur SMTP |
| `GEMINI_API_KEY` | clé Gemini production |
| `GOTENBERG_URL` | URL privée du service, par ex. `http://gotenberg:3000` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | accès S3 limité aux deux buckets |
| `AWS_S3_BUCKET_NAME` | bucket privé PDFs, audio et lectures |
| `AWS_UPLOADS_BUCKET_NAME` | bucket privé photos et uploads clients |

Génération locale des secrets :

```bash
openssl rand -base64 48  # JWT_SECRET
openssl rand -base64 32  # SETTINGS_ENCRYPTION_KEY
```

Les alias `FRONTEND_URL`, `AWS_LECTURES_BUCKET_NAME`, `AWS_S3_BUCKET_READINGS`, `S3_READING_BUCKET` et `S3_UPLOAD_BUCKET` restent tolérés pour une ancienne installation, mais ne sont pas la configuration canonique.

## 4. Variables Web et arguments de build

Définir les trois valeurs au runtime :

| Variable | Valeur attendue |
| --- | --- |
| `NODE_ENV` | `production` |
| `API_INTERNAL_URL` | URL API privée, par ex. `http://api:3001` |
| `JWT_SECRET` | exactement le même secret que l’API |

Définir aussi ces arguments au build de l’image Web ; ils sont compilés dans le bundle navigateur :

| Argument | Valeur attendue |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL API publique, par ex. `https://api.oraclelumira.com` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | clé Stripe publiable live |
| `API_INTERNAL_URL` | URL API privée |

Toute modification d’une variable `NEXT_PUBLIC_*` exige un nouveau build du Web.

## 5. S3 et Stripe

Les deux buckets doivent avoir le blocage d’accès public activé. Le rôle IAM Lumira ne reçoit que les droits nécessaires aux objets de ces buckets. Le bucket d’uploads doit autoriser en CORS l’origine Web officielle, les méthodes `PUT` et `GET`, ainsi que l’en-tête `Content-Type`.

Dans Stripe live, créer l’endpoint :

```text
https://api.oraclelumira.com/api/payments/webhook
```

Reporter son secret `whsec_…` dans `STRIPE_WEBHOOK_SECRET`. Vérifier qu’un événement de test reçoit HTTP 2xx avant d’ouvrir le checkout.

## 6. Première mise en ligne

1. Restaurer ou créer la base PostgreSQL, puis prendre un snapshot si elle contient déjà des données.
2. Démarrer PostgreSQL et Gotenberg.
3. Déployer l’API. Son démarrage applique uniquement les migrations en attente.
4. Vérifier `GET https://api.oraclelumira.com/api/health` : réponse HTTP 200 avec `database: "ok"`.
5. Déployer le Web avec les arguments de build de production.
6. Vérifier `GET https://oraclelumira.com/api/health` : réponse HTTP 200 avec `api: "ok"`.
7. Configurer le webhook Stripe puis exécuter les smoke tests ci-dessous.

### Cas particulier : ancienne base sans historique Prisma

Ne jamais exécuter un baseline automatiquement. Après sauvegarde, comparer le schéma réel à la migration initiale. Si et seulement si le schéma initial est déjà présent et que la table `_prisma_migrations` est absente, exécuter une fois depuis un shell API :

```bash
prisma migrate resolve --applied 20250617000000_init --schema=packages/database/prisma/schema.prisma
prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

## 7. Smoke tests d’acceptation

Exécuter avec un produit et une adresse e-mail de test :

- Landing et checkout chargés sans erreur console bloquante.
- Paiement Stripe live de faible montant, webhook 2xx et commande passée à `PAID` une seule fois.
- Session Sanctuaire créée après paiement, puis récupérable par lien magique.
- Onboarding sauvegardé avec consentements et photo privée.
- Génération d’une lecture, ouverture de la version validée et téléchargement PDF.
- Validation expert créant une livraison `SENT` et un e-mail réellement reçu.
- Échec SMTP simulé visible comme `FAILED`, puis retry aboutissant à `SENT` sans doublon métier.
- Navigation mobile Sanctuaire et Desk expert.

La livraison commerciale ne doit être ouverte qu’après succès de ces tests sur l’environnement client réel ; les secrets et services tiers ne peuvent pas être prouvés depuis un poste de développement.

## 8. Exploitation et rollback

- Sauvegarde PostgreSQL quotidienne, rétention minimale de 14 jours, test de restauration mensuel.
- Alarmes sur healthchecks, erreurs Stripe, génération IA/PDF, S3 et SMTP.
- Pour un rollback applicatif, redéployer l’image précédente du Web et/ou de l’API.
- Ne pas annuler une migration par suppression manuelle. Les migrations de cette livraison sont additives ; conserver la base et corriger par une nouvelle migration si nécessaire.
- En cas d’incident paiement, désactiver temporairement le checkout avant toute intervention sur les commandes.

## 9. Critère GO

Le code est déclarable **GO sous conditions d’infrastructure** lorsque : build CI vert, migrations applicables, healthchecks 200, Stripe live reçu en 2xx, buckets privés accessibles, e-mail transactionnel reçu et parcours paiement → Sanctuaire → validation → livraison validé de bout en bout.

## 10. Preuve de recette locale — 17 juillet 2026

| Contrôle | Résultat |
| --- | --- |
| Installation pnpm figée | OK |
| Schéma et génération Prisma 5.22 | OK |
| Typecheck API et Web | OK |
| Lint monorepo | OK, avertissements UI non bloquants recensés |
| Tests API | OK — 117/117 |
| Audit dépendances niveau high | OK — aucune vulnérabilité connue |
| Build API isolé | OK |
| Build Web standalone isolé | OK |
| E2E Playwright desktop + mobile | OK — 75/75 scénarios validés |

La suite Playwright complète est verte sur Chromium desktop et Pixel 5. Elle couvre notamment l’achat, l’authentification, le Sanctuaire, le chat, les lectures, les rêves, la synthèse/Insights, le profil et le shell mobile.

Limites du poste de recette : Docker n’est pas installé et PostgreSQL local n’est pas démarré. Les images Docker ont donc été inspectées statiquement mais doivent être construites par la CI/Coolify ; `prisma migrate status` et les smoke tests fournisseurs doivent être exécutés dans l’infrastructure client selon les sections précédentes.
