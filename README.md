# Lumira V2 - Monorepo Turborepo

Fondation pour la migration de Oracle Lumira (V1) vers une architecture moderne.

## 🚀 Structure du Monorepo

```plaintext
lumira-v2/
├── apps/
│   ├── web/          # Next.js 14 (App Router) - Frontend
│   └── api/          # NestJS 10 - Backend API
├── packages/
│   ├── config/       # Shared ESLint, TS, Tailwind configs
│   ├── shared/       # Shared types & constants
│   ├── ui/           # Shared React UI components
│   └── database/     # Prisma client & schema
├── docker/           # Infrastructure local (PostgreSQL)
└── .github/          # CI/CD (GitHub Actions)
```

## 🛠 Flow Développeur

1. **Installation**

    ```bash
    pnpm install
    ```

2. **Base de données (Local)**

    ```bash
    # Lancer PostgreSQL
    docker-compose -f docker/docker-compose.yml up -d
    
    # Générer le client Prisma & Pousser le schema
    pnpm db:generate
    pnpm db:push
    ```

3. **Développement**

    ```bash
    pnpm dev
    ```

    - Frontend : [http://localhost:3000](http://localhost:3000)
    - Backend  : [http://localhost:3001/api](http://localhost:3001/api)

4. **Build & Qualité**

    ```bash
    pnpm build
    pnpm lint
    pnpm test
    ```

## 📜 Stack Technique

- **Monorepo :** Turborepo + pnpm workspaces
- **Frontend :** Next.js 14 (App Router), Tailwind CSS
- **Backend :** NestJS 10
- **Base de données :** PostgreSQL + Prisma ORM
- **Langage :** TypeScript (Strict Mode)
