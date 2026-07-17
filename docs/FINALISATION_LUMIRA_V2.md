# Finalisation Lumira V2 — cartographie de référence

> Branche : `finalisation/lumira-v2-launch-ready`  
> Référence analysée : `b3fb7ec` (`origin/main` au 16 juillet 2026)  
> Statut : audit initial et lots P0 prioritaires exécutés.

## Sources lues

- `AGENTS.md` et les compétences actives de `.agents/skills/`.
- `.github/copilot-instructions.md`, les compétences historiques pertinentes de `skills/`, les workflows GitHub Actions et les tests E2E existants.
- `MASTER_AUDIT_LUMIRA_V2.md`, `AUDIT_SANCTUAIRE.md`, `audit_lumira_v2.txt` et `packages/database/prisma/schema.prisma`.

`docs/VISION_FINALE_LUMIRA_V2.md` et les documents A1, B1 et C1 ne sont pas présents dans le dépôt à cet état. Ils ne peuvent donc pas servir de preuve d’implémentation.

## État de la base

| Contrôle                         | Résultat | Preuve                                                                                                                   |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | OK       | Lockfile reproductible avec pnpm 8.15.4.                                                                                 |
| `pnpm db:generate`               | OK       | Prisma Client 5.22.0 généré.                                                                                             |
| `pnpm typecheck`                 | ÉCHEC    | `@packages/ui` cherche `packages/ui/node_modules/typescript/bin/tsc`, introuvable.                                       |
| `pnpm lint`                      | ÉCHEC    | `_capability` inutilisé dans `packages/shared/src/entitlements/index.ts:114`.                                            |
| `pnpm test`                      | BLOQUÉ   | Le lanceur Turbo ne retourne pas dans la fenêtre de diagnostic (plus de 2 minutes, sans sortie). À isoler par workspace. |
| `pnpm build`                     | BLOQUÉ   | Même comportement de non-retour du lanceur global. À isoler par workspace.                                               |
| `pnpm exec playwright test`      | ÉCHEC    | Le serveur `pnpm --filter web dev` ne répond pas avant les 120 s configurées dans `playwright.config.ts`.                |

## Matrice exigences → implémentation → écarts

| Exigence produit                                       | Fichier de référence                                            | Implémentation actuelle                                                                                                                         | Écart                                                                                                                                                                                                | Priorité | Test requis                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| CI reproductible et verte                              | `.github/workflows/ci.yml`, `package.json`, `turbo.json`        | Installation et Prisma passent ; typecheck, lint et E2E échouent ou se bloquent.                                                                | La branche n’est pas livrable sans corriger la résolution TypeScript, le lint et le démarrage web.                                                                                                   | P0       | Typecheck/lint/build/tests racine et smoke web/API dans CI.                                         |
| Checkout à paiement unique et accès durable            | `AGENTS.md`, `payments.service.ts`, `auth.service.ts`           | `confirmCheckout()` vérifie un PaymentIntent réussi et émet une session ; webhook signé avec `ProcessedEvent`.                                  | La coexistence de flux `PaymentIntent`, Checkout Session et abonnements legacy doit être inventoriée/testée, notamment annulation, remboursement et double traitement.                               | P0       | Paiement réussi/échoué/abandonné, webhook dupliqué, remboursement, réconciliation.                  |
| Accès Sanctuaire uniquement après paiement             | `AGENTS.md`, `users.service.ts:95`                              | `PENDING` ne donne plus accès ; les états payés/in-progress/failed donnent accès.                                                               | La politique de remboursement/révocation et la preuve de l’accès lifetime ne sont pas tracées par un entitlement explicite.                                                                          | P0       | Non payé/refusé, payé/accepté, remboursé/réconciliation.                                            |
| Lien magique sécurisé                                  | `auth.service.ts:138-209`, schéma Prisma                        | Token aléatoire hashé, TTL 15 min, consommation atomique, réponse anti-énumération.                                                             | Aucun test unitaire de concurrence/expiration/réemploi dans la suite actuelle ; la délivrance e-mail n’est pas instrumentée comme livraison durable.                                                 | P0       | Valide, expiré, réutilisé, concurrent, adresse inconnue/non payée.                                  |
| Onboarding essentiel mobile et progressif              | `HolisticWizard.tsx`, `OracleOnboardingChat.tsx`, `UserProfile` | Brouillon principalement en `localStorage`; deux écrans d’onboarding coexistent.                                                                | Pas de progression serveur, reprise multi-appareil ni jeton de reprise ; pas de vrai parcours « terminer plus tard » et de relances limitées.                                                        | P0       | Reprise navigateur, autre appareil, maintenant/plus tard, 375 px.                                   |
| Consentement avant photo et preuve persistante         | `HolisticWizard.tsx`, schéma Prisma                             | Une étape de consentement UI existe dans le wizard historique.                                                                                  | Aucun `ConsentRecord`, version, finalité, horodatage ou preuve liée à l’upload ; le consentement n’est pas imposé avant le premier upload.                                                           | P0       | Refus sans consentement, consentement persistant, audit de la preuve.                               |
| Photos privées, validées et référencées                | `OracleOnboardingChat.tsx`, `users.service.ts`, `OrderFile`     | Les profils acceptent directement `facePhotoUrl`/`palmPhotoUrl`; `OrderFile` contient déjà clé/type/MIME/taille.                                | Le flux actuel accepte des chaînes client (dont Base64 possible), ne lie pas les assets au propriétaire/consentement et ne valide pas dimensions, orientation, checksum ou corruption.               | P0       | MIME réel, taille, dimensions/orientation, fichier corrompu, accès d’un autre client, remplacement. |
| Machine d’état de production explicite                 | `OrderStatus`, `DigitalSoulService`, `ExpertService`            | Enum historique `PENDING → PAID → PROCESSING → AWAITING_VALIDATION → COMPLETED`, plus `FAILED/REFUNDED`; contrôles ponctuels dans les services. | Pas de `OrderStatusEvent`, transitions centralisées, motif/auteur ni verrou de génération atomique. Les états Core Onboarding et remplacement photo n’existent pas.                                  | P0       | Transition nominale, interdite, concurrence/double génération, reprise après erreur.                |
| Lecture validée comme source unique du PDF             | `expert.service.ts:1158-1333`, `DigitalSoulService.ts:297-412`  | Le Studio peut écrire `generatedContent.lecture`; le PDF lit exclusivement `generatedContent.pdf_content`.                                      | Correction humaine non synchronisée dans la structure PDF : une phrase éditée peut ne jamais être livrée. Pas de version canonique, hash, auteur/paramètres ou scellement immuable.                  | P0       | Éditer une phrase dans le Desk, produire le PDF, vérifier cette phrase et l’identifiant de version. |
| Livraison privée et notifications traçables            | `DigitalSoulService.ts:362-412`, `readings`, notifications      | PDF S3 privé avec endpoint logique `/api/readings/:orderNumber/download`.                                                                       | Aucun `DeliveryAsset`/`EmailDelivery`, statut ou tentatives persistés ; échec e-mail seulement journalisé/capturé, pas de relance durable ; validation PDF avant livraison à prouver.                | P0       | Propriétaire/expert autorisé, tiers refusé, échec/réessai S3/e-mail, URL jamais brute.              |
| Recette E2E bout-en-bout                               | `tests/e2e/`, `playwright.config.ts`                            | Tests principalement UI avec mocks de fournisseurs ; pas de trois scénarios de production demandés.                                             | La recette ne démarre pas actuellement et ne couvre pas checkout → reprise → validation → PDF → notification avec la logique métier réelle.                                                          | P0       | Immédiat, terminer plus tard, photo rejetée/remplacée, incluant Desk et téléchargement.             |
| Routage IA appliqué partout                            | `AiRoutingRule`, `ai-routing.service.ts`, `VertexOracle.ts`     | Règles produit × agent × mission, provider/modèle/température/maxTokens existent ; plusieurs appels sont routés.                                | `topP` n’est pas persisté dans la règle ; `PromptVersion` est retournée mais son contenu n’est pas appliqué de manière démontrée à tous les flux ; des chemins Gemini/multimodaux restent à auditer. | P1       | Règle exacte, fallback, texte/JSON/chat/multimodal, prompt sélectionné réellement injecté.          |
| Snapshots/coûts/version IA et comparaison Desk         | `schema.prisma`, Desk, `VertexOracle.ts`                        | PromptVersion et règles existent.                                                                                                               | Pas de modèle `AiRun`, ni coût/durée/tokens/snapshot, comparaison côte à côte ou choix auditable de sortie.                                                                                          | P1       | Persistance d’un run réussi/échoué, comparaison reproductible même entrée.                          |
| Observabilité, récupération et sécurité opérationnelle | `main.ts`, services factory, audits                             | Journaux NestJS et quelques erreurs de commande existent ; lien magique et webhook déjà durcis.                                                 | Pas de corrélation standard `requestId/orderId/aiRunId`, dashboard d’incidents, runbook, ni cycle de vie/suppression/export des données formalisé.                                                   | P1       | Redaction PII/secrets, erreur IA/PDF/S3/e-mail, rate limit et RBAC.                                 |
| RAG, podcast durable, Mandala interactif               | Vision fournie dans la demande, services audio                  | Audio est lancé en fire-and-forget ; Mandala/AnythingLLM ne constituent pas un parcours de livraison auditable.                                 | Ces lots ne doivent commencer qu’après P0 vert.                                                                                                                                                      | P2       | Jobs persistants, sources RAG, accessibilité Mandala et accès audio privé.                          |

## Décisions de périmètre pour le prochain lot

1. Corriger d’abord P0.1 : les erreurs de CI reproductibles, puis rendre le serveur web observable/démarrable afin que Playwright puisse valider le produit.
2. Corriger ensuite P0.4 en tranche verticale, car le défaut Studio → PDF est un risque de livraison directe, précis et déjà prouvé.
3. Les migrations de données structurantes (onboarding, états, versions, livraisons, AI runs) seront conçues après l’établissement d’une CI verte pour éviter de multiplier les risques simultanés.

## Risques déjà ouverts

- Les rapports historiques décrivent des abonnements ; `AGENTS.md` et le code récent font du Sanctuaire un accès permanent après commande payée. Les tests et libellés historiques devront être alignés sur la règle actuelle sans supprimer le legacy sans inventaire.
- Les contrôles globaux Turbo ne fournissent pas de diagnostic final dans l’environnement actuel ; les causes devront être isolées par workspace avant de conclure à un défaut de build.
- Aucun dossier `docs/` ni document A1/B1/C1/Vision finale n’était versionné au moment de l’audit ; les exigences correspondantes proviennent donc exclusivement de la demande fournie.

## REVUE TERRA À EFFECTUER

- Confirmer que le périmètre P0 immédiat est bien : CI, canonicalisation de la lecture/PDF, puis données onboarding et machine d’état.
- Valider la stratégie de version canonique de lecture : nouvelle table `ReadingVersion` plutôt que surcharge de `Order.generatedContent`.
- Arbitrer le niveau de preuve légal attendu pour le consentement photo (version de texte, finalité, rétention, IP tronquée/hashée).
- Confirmer la politique produit à appliquer à un remboursement : maintien ou révocation de l’accès lifetime.

## Exécution P0 — 17 juillet 2026

### Livré

| Lot                 | Livraison                                                                                                                                      | Preuve code |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| CI et E2E           | Typecheck UI fiabilisé, lint corrigé, tests découplés du build et Playwright lancé contre le standalone isolé.                                 | `b0276ed`   |
| Studio → PDF        | `ReadingVersion` scellée, hashée et relue exclusivement lors du rendu PDF ; le brouillon AI ne peut plus écraser une correction du Studio.     | `8dc05a2`   |
| Onboarding et accès | Brouillon serveur, consentement versionné, photos privées S3 sans Base64 persistant, et accès lifetime fondé seulement sur une commande payée. | `bd76a7a`   |
| Livraison           | Registre persistant liant PDF privé, version scellée, hash et état/tentatives d’e-mail.                                                        | `0dee7da`   |

### Migrations à déployer

1. `20260716000000_add_reading_versions`
2. `20260716000100_add_onboarding_progress_and_consents`
3. `20260716000200_add_delivery_records`

Exécuter `pnpm --filter @packages/database db:migrate:deploy` dans l’environnement cible avant le déploiement applicatif.

### Recette finale effectuée

| Commande                                                                                              | Résultat                                                                     |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm db:generate`                                                                                    | OK                                                                           |
| `pnpm typecheck`                                                                                      | OK                                                                           |
| `pnpm lint`                                                                                           | OK, avertissements Next préexistants sur des balises `<img>` et un hook Desk |
| `pnpm test`                                                                                           | OK — 109 tests API                                                           |
| `pnpm exec playwright test tests/e2e/landing.spec.ts tests/e2e/order-flow.spec.ts --project=chromium` | OK — 4/4                                                                     |
| `pnpm --filter api run build`                                                                         | OK                                                                           |
| `pnpm --filter web run build`                                                                         | OK                                                                           |

### Écarts ouverts conservés explicitement

- P0 restant : la table historique des transitions d’état et les transitions atomiques centralisées restent à livrer ; la nouvelle traçabilité de livraison ne remplace pas cette machine d’état.
- La politique de remboursement/révocation lifetime, les relances planifiées d’e-mail et la purge/export RGPD nécessitent une décision produit et un lot dédié.
- Les observables IA complets (`AiRun`, coûts, snapshots, comparaison) et les lots RAG/podcast/Mandala restent hors du P0 livré.
