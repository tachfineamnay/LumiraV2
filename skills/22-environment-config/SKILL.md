---
name: Environment Variables & Configuration
description: Toutes les variables d'environnement de Lumira V2, leur usage, et la configuration par environnement (dev/prod).
---

# Environment Variables & Configuration

## Context

Lumira V2 utilise deux fichiers `.env` principaux :

- `apps/api/.env` → Variables du backend NestJS
- `apps/web/.env.local` → Variables du frontend Next.js

**Référence** : `.env.example` à la racine du monorepo.

---

## Variables Backend (API)

### Base de données

```bash
DATABASE_URL="postgresql://user:password@host:5432/lumira_db?schema=public"
```

### Serveur

```bash
PORT=3001
NODE_ENV=development    # production | development | test
```

### Authentication JWT

```bash
JWT_SECRET="your-256-bit-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"
```

### Stripe

```bash
STRIPE_SECRET_KEY="sk_test_..."      # sk_live_... en production
STRIPE_WEBHOOK_SECRET="whsec_..."    # Secret de signature webhook
```

### Google Gemini AI

```bash
GEMINI_API_KEY="AIza..."             # Clé API Google AI Studio
```

### AWS S3 (Uploads)

```bash
AWS_REGION="eu-west-3"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="lumira-uploads-prod"
AWS_S3_BUCKET_URL="https://lumira-uploads-prod.s3.amazonaws.com"
AWS_LECTURES_BUCKET_NAME="lumira-lectures"  # Separate bucket for audio (fallback: AWS_S3_BUCKET)
```

### Google Cloud TTS (Audio)

```bash
GOOGLE_CLOUD_TTS_KEY_JSON="base64-encoded-service-account-json"  # Required for audio generation
TTS_USE_JOURNEY_VOICES="false"  # Set to "true" for Journey voices instead of Neural2
```

### Email (Notifications)

```bash
SMTP_HOST="smtp.resend.com"
SMTP_PORT=587
SMTP_USER="resend"
SMTP_PASS="re_..."                   # Clé API Resend
SMTP_FROM="Oracle Lumira <no-reply@oraclelumira.com>"
```

### CORS

```bash
WEB_URL="http://localhost:3000"      # https://oraclelumira.com en prod
```

---

## Variables Frontend (Web)

### API Connection

```bash
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
# Production: NEXT_PUBLIC_API_URL="https://api.oraclelumira.com/api"
```

### Stripe

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."   # pk_live_... en production
```

### Analytics (optionnel)

```bash
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://eu.posthog.com"
```

---

## Accès aux variables depuis NestJS

```typescript
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService) {}

  getApiKey(): string {
    return this.configService.get<string>('GEMINI_API_KEY');
  }

  getStrictApiKey(): string {
    const key = this.configService.get<string>('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY is not defined');
    return key;
  }
}
```

---

## Accès depuis Next.js

```typescript
// Variables NEXT_PUBLIC_ → accessibles côté client et serveur
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Variables sans préfixe → accessibles UNIQUEMENT côté serveur
const secret = process.env.JWT_SECRET; // Server Actions, API routes uniquement
```

---

## Configuration par environnement

### Développement local

```bash
# apps/api/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/lumira_dev"
NODE_ENV=development
PORT=3001
JWT_SECRET=dev-secret-local
STRIPE_SECRET_KEY=sk_test_...
GEMINI_API_KEY=AIza...

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Production (Coolify)

Les variables sont injectées via l'interface Coolify, **pas de fichier `.env`** sur le serveur. Voir le skill `10-coolify` pour la configuration.

```bash
# Domaines de production
Web: https://oraclelumira.com
API: https://api.oraclelumira.com (ou port 3001 interne)
Admin: https://desk.oraclelumira.com
```

---

## Validation au démarrage

Il est recommandé de valider les variables critiques au boot :

```typescript
// apps/api/src/app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    STRIPE_SECRET_KEY: Joi.string().required(),
    GEMINI_API_KEY: Joi.string().required(),
    PORT: Joi.number().default(3001),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  }),
}),
```

---

## Checklist de déploiement

Avant de déployer en production, vérifier :

- [ ] `DATABASE_URL` pointe vers la base de données de production
- [ ] `JWT_SECRET` est une clé forte (≥ 256 bits)
- [ ] `STRIPE_SECRET_KEY` est une clé **live** (pas test)
- [ ] `STRIPE_WEBHOOK_SECRET` correspond au webhook Stripe configuré
- [ ] `GEMINI_API_KEY` est valide et a des quotas suffisants
- [ ] `GOOGLE_CLOUD_TTS_KEY_JSON` est configuré (base64 du service account JSON avec TTS API activée)
- [ ] `AWS_S3_BUCKET` est le bucket de production
- [ ] `WEB_URL` correspond au domaine de production
- [ ] `NEXT_PUBLIC_API_URL` pointe vers l'API de production

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Utiliser `ConfigService` dans NestJS | Utiliser `process.env` directement dans les services |
| Valider les variables au démarrage avec Joi | Laisser des variables manquantes causer des erreurs en runtime |
| Prefix `NEXT_PUBLIC_` pour les variables côté client | Exposer des secrets dans `NEXT_PUBLIC_` |
| Garder `.env.example` à jour | Commiter `.env` dans Git |
| Utiliser des secrets forts (≥32 chars) en prod | Réutiliser les secrets de dev en prod |
