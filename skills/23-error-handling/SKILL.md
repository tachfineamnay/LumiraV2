---
name: Error Handling & Debugging
description: Stratégies de gestion d'erreurs, logging, debugging et troubleshooting dans la stack NestJS + Next.js de Lumira V2.
---

# Error Handling & Debugging

## Context

Lumira V2 utilise une approche cohérente pour la gestion d'erreurs :

- **Backend** : Exceptions NestJS + Logger natif
- **Frontend** : Error boundaries React + Axios interceptors
- **AI** : Retry logic avec backoff exponentiel

---

## Backend — NestJS

### Exceptions standard à utiliser

```typescript
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

// Usage
throw new NotFoundException(`Order ${id} introuvable`);
throw new BadRequestException('Date de naissance invalide');
throw new ForbiddenException('Accès refusé — niveau insuffisant');
throw new ConflictException('Cet email est déjà utilisé');
```

### Logging avec Logger NestJS

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  async processOrder(orderId: string) {
    this.logger.log(`Traitement commande ${orderId}`);

    try {
      // ...
      this.logger.log(`Commande ${orderId} traitée avec succès`);
    } catch (error) {
      this.logger.error(
        `Échec traitement commande ${orderId}`,
        error instanceof Error ? error.stack : String(error)
      );
      throw new InternalServerErrorException('Échec du traitement');
    }
  }
}

// ❌ JAMAIS console.log — toujours Logger
```

### Erreurs Prisma

```typescript
import { Prisma } from '@packages/database';

try {
  await prisma.user.create({ data });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002': throw new ConflictException('Doublon unique');
      case 'P2025': throw new NotFoundException('Non trouvé');
      case 'P2003': throw new BadRequestException('Référence invalide');
      default:
        this.logger.error(`Erreur Prisma inattendue: ${e.code}`, e);
        throw new InternalServerErrorException('Erreur base de données');
    }
  }
  throw e;
}
```

---

## AI — Retry avec backoff

```typescript
async generateWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.warn(
        `Tentative AI ${attempt}/${maxRetries} échouée: ${error.message}`
      );

      if (attempt === maxRetries) {
        throw new ServiceUnavailableException('Service AI indisponible');
      }

      // Backoff exponentiel : 2s, 4s, 8s...
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}
```

### Parsing safe des réponses AI

```typescript
async parseAIResponse<T>(raw: string, schema: z.ZodSchema<T>): Promise<T> {
  let json: unknown;

  // Nettoyage du markdown fréquemment ajouté par Gemini
  const cleaned = raw
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  try {
    json = JSON.parse(cleaned);
  } catch {
    this.logger.error('Réponse AI non-JSON', { raw: cleaned.slice(0, 200) });
    throw new InternalServerErrorException('Réponse AI invalide — format JSON attendu');
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    this.logger.error('Validation Zod échouée', result.error.flatten());
    throw new InternalServerErrorException('Réponse AI invalide — schéma incorrect');
  }

  return result.data;
}
```

---

## Frontend — Next.js

### Error Boundary React

```tsx
// components/ErrorBoundary.tsx
'use client';

import { Component } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### Gestion d'erreurs Axios

```typescript
// Wrapper pour les appels API
async function apiCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message ?? 'Une erreur est survenue';

      if (status === 401) {
        // Géré par l'intercepteur — redirect login
        throw error;
      }
      if (status === 403) {
        throw new Error('Accès non autorisé');
      }
      if (status === 404) {
        throw new Error('Ressource introuvable');
      }
      throw new Error(message);
    }
    throw error;
  }
}
```

### Toast d'erreur

```tsx
import { toast } from 'sonner'; // ou react-hot-toast

try {
  await api.post('/orders', data);
  toast.success('Commande créée avec succès');
} catch (error) {
  toast.error(
    error instanceof Error ? error.message : 'Une erreur est survenue'
  );
}
```

---

## Debugging — Commandes utiles

```bash
# Logs NestJS en temps réel
pnpm --filter api dev

# Voir les requêtes Prisma (debug mode)
# Dans apps/api/.env :
# DEBUG="prisma:query"

# Tester un endpoint directement
curl -X GET http://localhost:3001/api/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Vérifier la DB via Prisma Studio
pnpm db:studio

# Voir les erreurs TypeScript
pnpm typecheck
```

---

## Troubleshooting fréquent

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `401 Unauthorized` partout | Token JWT expiré | Refresh token ou re-login |
| `403 Forbidden` | Mauvais rôle utilisateur | Vérifier `@Roles()` sur l'endpoint |
| `500` sur upload | Fichier trop grand ou S3 mal configuré | Vérifier `AWS_S3_BUCKET` et limite 50MB |
| AI retourne du texte invalide | Gemini a ajouté du markdown | Utiliser le parsing avec nettoyage |
| `P2002` Prisma | Email déjà utilisé | Gérer avec `ConflictException` |
| `P2025` Prisma | ID inexistant | Vérifier avant d'update/delete |
| Webhook Stripe non traité | `rawBody` manquant | Vérifier config `main.ts` bodyParser |
| Types TS en erreur après `db:generate` | Client Prisma non regénéré | Relancer `pnpm db:generate` |

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Utiliser `Logger` NestJS dans tous les services | Utiliser `console.log` |
| Lancer des exceptions NestJS typées | Retourner `{ success: false }` sans status code |
| Logger le stack d'erreurs, pas juste le message | Swallow les erreurs silencieusement |
| Utiliser `safeParse()` Zod pour les réponses AI | Parser les réponses AI sans validation |
| Afficher des toasts d'erreur user-friendly | Exposer les messages d'erreur techniques à l'UI |
| Retry les appels AI avec backoff | Retry immédiatement en boucle |
