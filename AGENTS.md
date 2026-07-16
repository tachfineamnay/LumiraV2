# Lumira V2 — Instructions Codex

## Mission

Faire progresser Lumira V2 jusqu'à un produit lançable, cohérent et maintenable. Privilégier les parcours utilisateurs complets, les preuves par les tests et les corrections de cause racine plutôt que les rustines locales.

## Ordre des sources de vérité

En cas de contradiction, appliquer cet ordre :

1. code actuel, migrations, tests et `package.json` ;
2. commits récents de `main` ;
3. ce fichier et `.agents/skills/**/SKILL.md` ;
4. documentation historique (`README.md`, `.github/copilot-instructions.md`, `skills/`, anciens rapports).

Ne jamais réintroduire une ancienne règle produit uniquement parce qu'elle apparaît dans un document historique.

## Invariants produit actuels

- Le Sanctuaire est un accès permanent obtenu après au moins une commande `PAID`, pas un abonnement mensuel résiliable.
- L'accès client est délivré soit par un handoff serveur après vérification Stripe, soit par un lien magique e-mail à usage unique. Ne pas réintroduire mot de passe ou code OTP client sans décision produit explicite.
- Les liens magiques doivent rester non énumérables, stockés sous forme de hash, expirables et consommables une seule fois.
- L'authentification du Desk expert reste séparée de l'authentification client.
- Les anciens modèles ou endpoints d'abonnement peuvent subsister pour compatibilité. Ne pas les utiliser comme nouvelle source d'autorisation et ne pas les supprimer sans inventaire, migration et tests.
- Les contenus Lumira sont interprétatifs et d'accompagnement. Ne pas ajouter de promesses médicales, juridiques ou de certitudes factuelles non justifiées.

## Stack réelle

- Node.js 20, pnpm 8.15.4, Turborepo
- `apps/web` : Next.js 14, React 18, App Router, Tailwind CSS 3
- `apps/api` : NestJS 10, Jest, Socket.IO
- `packages/database` : PostgreSQL, Prisma 5.22
- Stripe, AWS S3, Gotenberg, Gemini/Vertex AI, OpenAI, Google Cloud TTS
- Docker/Coolify pour la production, Playwright pour les parcours E2E

## Méthode obligatoire

1. Lire les fichiers concernés avant de modifier le code et rechercher les usages transversaux.
2. Vérifier l'état Git et ne pas écraser des changements utilisateur non liés.
3. Travailler par tranche verticale : UI, API, données, sécurité et tests d'un même parcours.
4. Réutiliser les abstractions existantes avant d'en créer de nouvelles.
5. Éviter les refactors opportunistes non nécessaires à la tâche.
6. Pour tout changement Prisma : créer ou adapter une migration versionnée, régénérer le client et tester la compatibilité.
7. Pour tout changement de paiement, auth, webhook, stockage ou configuration : ajouter des tests de régression et vérifier les cas d'échec.
8. Ne jamais écrire de secret, clé, token, URL signée ou donnée personnelle dans le dépôt ou les logs.

## Commandes de référence

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

Exécuter d'abord les contrôles ciblés, puis les contrôles complets avant de déclarer une tâche terminée. Si un contrôle ne peut pas être exécuté, indiquer précisément la commande, la cause et le risque restant.

## Définition de terminé

Une modification est terminée uniquement si :

- le parcours nominal et les erreurs principales sont traités ;
- les frontières client/expert et serveur/client sont respectées ;
- les données et effets externes sont idempotents lorsque nécessaire ;
- les tests pertinents passent ;
- build, typecheck et lint ne régressent pas ;
- le compte rendu final liste les fichiers modifiés, les validations exécutées et les risques restant réellement ouverts.
