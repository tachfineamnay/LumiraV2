---
name: API Modules Reference
description: Référence complète des modules NestJS de Lumira V2 — auth, orders, payments, readings, notifications, uploads, webhooks, expert, client.
---

# API Modules Reference

## Context

L'API NestJS est organisée en **12 modules** dans `apps/api/src/modules/`. Chaque module suit un pattern strict : `module.ts` + `controller.ts` + `service.ts`.

- **Port dev** : 3001
- **Prefix global** : `/api`
- **Auth** : JWT Bearer token

---

## Vue d'ensemble des modules

| Module | Route préfixe | Rôle principal |
|--------|--------------|----------------|
| `auth` | `/api/auth` | JWT login, refresh, magic link |
| `users` | `/api/users` | Profil, entitlements |
| `client` | `/api/client` | Actions côté client |
| `expert` | `/api/expert` | Tableau de bord expert/admin |
| `orders` | `/api/orders` | Commandes + contenu généré |
| `payments` | `/api/payments` | Sessions Stripe |
| `products` | `/api/products` | Catalogue produits |
| `readings` | `/api/readings` | Lectures AI |
| `insights` | `/api/insights` | Cartes d'insights |
| `notifications` | `/api/notifications` | Push/email notifications |
| `uploads` | `/api/uploads` | Upload photos (S3) |
| `webhooks` | `/api/webhooks` | Stripe webhooks |

---

## Module : Auth

### Endpoints clés

```typescript
POST /api/auth/login              // Email + password → { accessToken, refreshToken }
POST /api/auth/refresh            // { refreshToken } → { accessToken }
POST /api/auth/magic-link         // Email → lien de connexion magique
GET  /api/auth/magic-link/verify  // Vérifie le token magique
POST /api/auth/logout             // Invalide le refreshToken
```

### Guards disponibles

```typescript
@UseGuards(JwtAuthGuard)       // Requiert JWT valide
@UseGuards(JwtAuthGuard, RolesGuard)  // Requiert rôle spécifique
@Roles(Role.ADMIN, Role.EXPERT)       // Décorateur de rôle
```

### Décorateur CurrentUser

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user: User) {
  return user; // Injecté automatiquement depuis le JWT
}
```

---

## Module : Orders

### Cycle de vie

```
PENDING → PAID → PROCESSING → AWAITING_VALIDATION → COMPLETED
                      │               │
                      ▼               ▼
                 AI Generation   Expert Review
```

### Endpoints

```typescript
GET  /api/orders              // Liste les ordres de l'utilisateur connecté
GET  /api/orders/:id          // Détails + generatedContent (PDF, insights, path)
POST /api/orders/:id/validate // Expert valide l'ordre (role: EXPERT)
```

### Structure generatedContent

```typescript
interface GeneratedContent {
  pdf_url?: string;              // URL S3 du PDF
  synthesis?: ReadingSynthesis;  // Archétype + keywords
  insights?: InsightCard[];      // 8 cartes d'insights
  timeline?: TimelineDay[];      // Plan 7 jours
  akashic_record?: string;       // Texte registre akashique
}
```

---

## Module : Payments

### Création de session Stripe

```typescript
// POST /api/payments/create-session
interface CreateSessionDto {
  productId: 'initie' | 'mystique' | 'profond' | 'integrale';
  formData: OnboardingData;      // Données du wizard onboarding
}

// Réponse
interface SessionResponse {
  sessionId: string;
  url: string;                   // Redirect URL Stripe Checkout
}
```

---

## Module : Uploads

### Upload de photo

```typescript
// POST /api/uploads/photo
// Content-Type: multipart/form-data
// Field: file (image), type: 'face' | 'palm'

interface UploadResponse {
  url: string;   // URL publique S3
  key: string;   // Clé S3
}
```

### Contraintes

- Max size : 50 MB (configuré dans `main.ts`)
- Types acceptés : `image/jpeg`, `image/png`, `image/webp`
- Stockage : AWS S3 via `@aws-sdk/client-s3`

---

## Module : Webhooks

### Signature Stripe

```typescript
// Raw body REQUIS pour vérifier la signature
// main.ts configure bodyParser: false + rawBody capture

@Post('stripe')
async handleStripeWebhook(
  @Headers('stripe-signature') sig: string,
  @Req() req: RawBodyRequest
) {
  const event = stripe.webhooks.constructEvent(
    req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET
  );
}
```

### Événements traités

| Événement Stripe | Action déclenchée |
|-----------------|-------------------|
| `checkout.session.completed` | Crée Order (PAID) + lance DigitalSoulService |
| `payment_intent.payment_failed` | Met à jour Order (FAILED) |
| `customer.subscription.deleted` | Révoque entitlements |

---

## Module : Expert

### Rôles requis

```typescript
@Roles(Role.EXPERT, Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
```

### Endpoints principaux

```typescript
GET  /api/expert/orders           // Toutes les commandes (filtrable)
GET  /api/expert/orders/pending   // Commandes en attente de validation
POST /api/expert/orders/:id/validate // Valider + optionnel: modifier contenu
GET  /api/expert/clients          // Liste des clients
GET  /api/expert/stats            // KPIs dashboard
```

---

## Notifications

```typescript
// POST /api/notifications/send
interface SendNotificationDto {
  userId: string;
  type: 'ORDER_COMPLETE' | 'CHAT_MESSAGE' | 'PATH_REMINDER';
  data?: Record<string, unknown>;
}
```

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Utiliser `@CurrentUser()` pour récupérer l'user | Faire confiance aux IDs dans le body |
| Valider tous les inputs via DTOs + `class-validator` | Accéder à Prisma directement depuis le controller |
| Lancer exceptions NestJS standard | Utiliser `res.status().json()` manuellement |
| Documenter les réponses avec tipos TypeScript | Retourner des `any` |
| Protéger les routes sensibles avec `RolesGuard` | Laisser des routes admin sans guard |
