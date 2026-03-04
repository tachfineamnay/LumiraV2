---
name: Prisma & Database Patterns
description: Patterns Prisma ORM utilisés dans Lumira V2 — requêtes, transactions, schema navigation, et bonnes pratiques de performance.
---

# Prisma & Database Patterns

## Context

- **ORM** : Prisma 5+
- **Base de données** : PostgreSQL
- **Package** : `@packages/database`
- **Schema** : `packages/database/prisma/schema.prisma`
- **Client** : Généré dans `node_modules/.prisma/client`

---

## Import standard

```typescript
// Dans un service NestJS
import { prisma } from '@packages/database';

// Ou via injection (si PrismaService est fourni)
constructor(private readonly prisma: PrismaService) {}
```

---

## Modèles principaux

| Modèle | Description |
|--------|-------------|
| `User` | Compte utilisateur (client ou expert) |
| `UserProfile` | Données onboarding (birth, photos, context) |
| `Order` | Commande avec statut et contenu généré |
| `Product` | Catalogue des offres (initié → intégrale) |
| `Insight` | Carte d'insight AI pour un utilisateur |
| `SpiritualPath` | Plan 7 jours de l'utilisateur |
| `PathStep` | Étape individuelle du spiritual path |
| `ChatSession` | Session de chat avec Oracle Lumira |
| `Message` | Message individuel dans un ChatSession |
| `Notification` | Notification utilisateur |
| `AkashicRecord` | Registre akashique (niveau 4) |

---

## Requêtes courantes

### Trouver un user avec son profil

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    profile: true,
    orders: {
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
});
```

### Filtrer les commandes

```typescript
const orders = await prisma.order.findMany({
  where: {
    userId,
    status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION'] },
  },
  include: {
    product: true,
    user: { select: { email: true, id: true } },
  },
  orderBy: { createdAt: 'desc' },
});
```

### Pagination

```typescript
const { page = 1, limit = 20 } = dto;

const [items, total] = await Promise.all([
  prisma.order.findMany({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.order.count({ where: filters }),
]);

return { items, total, page, totalPages: Math.ceil(total / limit) };
```

---

## Transactions

### Pour les opérations atomiques

```typescript
// Après paiement réussi : créer order + profil en transaction
const result = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: {
      userId,
      productId,
      status: 'PAID',
      stripeSessionId,
    },
  });

  // Met à jour le profil avec les données d'onboarding
  await tx.userProfile.upsert({
    where: { userId },
    create: { userId, ...profileData },
    update: { ...profileData },
  });

  return order;
});
```

### Transaction interactive (long)

```typescript
// Pour les workflows complexes avec timeout
const result = await prisma.$transaction(
  async (tx) => {
    // Génération AI + sauvegarde peut prendre >5s
    const reading = await vertexOracle.generate(data);
    
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        generatedContent: reading,
      },
    });

    // Créer les insights individuels
    await tx.insight.createMany({
      data: reading.insights.map((i) => ({
        userId,
        orderId,
        ...i,
      })),
    });
  },
  { timeout: 30000 } // 30s pour les workflows AI
);
```

---

## Upsert Pattern

Utilisé pour `UserProfile` (1 seul par user) :

```typescript
const profile = await prisma.userProfile.upsert({
  where: { userId },
  create: {
    userId,
    birthDate: dto.birthDate,
    birthPlace: dto.birthPlace,
    specificQuestion: dto.specificQuestion,
  },
  update: {
    birthDate: dto.birthDate,
    specificQuestion: dto.specificQuestion,
    // Mise à jour partielle possible
  },
});
```

---

## Select — Optimisation des requêtes

**Toujours sélectionner uniquement les champs nécessaires** pour éviter les données sensibles et améliorer les performances :

```typescript
// ✅ Sélection ciblée
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    role: true,
    // Pas de password, pas de refreshToken
  },
});

// ❌ Éviter (expose tous les champs)
const users = await prisma.user.findMany();
```

---

## Relations imbriquées

```typescript
// Commande avec tout le contenu nécessaire pour le Sanctuaire
const order = await prisma.order.findUnique({
  where: { id: orderId },
  include: {
    product: true,
    user: {
      include: { profile: true },
    },
    insights: {
      orderBy: { category: 'asc' },
    },
    spiritualPath: {
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    },
  },
});
```

---

## Migrations

```bash
# Créer et appliquer une migration
pnpm db:migrate

# Push schéma sans migration (dev rapide)
pnpm db:push

# Régénérer le client après changement de schéma
pnpm db:generate

# Interface Prisma Studio
pnpm db:studio

# Seed de données de test
pnpm db:seed
```

---

## Gestion des erreurs Prisma

```typescript
import { Prisma } from '@packages/database';
import { ConflictException, NotFoundException } from '@nestjs/common';

async function createUser(data: CreateUserDto) {
  try {
    return await prisma.user.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        throw new ConflictException('Email déjà utilisé');
      }
      if (e.code === 'P2025') {
        throw new NotFoundException('Enregistrement introuvable');
      }
    }
    throw e;
  }
}
```

### Codes d'erreur Prisma fréquents

| Code | Signification |
|------|--------------|
| `P2002` | Violation contrainte unique |
| `P2025` | Enregistrement non trouvé |
| `P2003` | Violation clé étrangère |
| `P2016` | Interprétation requête erreur |

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Utiliser `select` pour limiter les données renvoyées | Retourner des `findMany()` sans select sur des modèles sensibles |
| Wrapper les opérations multi-tables en `$transaction` | Faire des opérations liées sans transaction |
| Gérer les erreurs Prisma avec codes spécifiques | Laisser filtrer les erreurs Prisma brutes |
| Utiliser `upsert` pour les modèles 1-to-1 | delete + create séparément |
| Indexer les champs de filtre fréquents dans le schema | Ignorer les performances de requête |
| Fermer Prisma proprement dans les tests (`prisma.$disconnect()`) | Laisser des connexions ouvertes |
