# Lumira V2 — Cartographie Baseline du Pipeline Expert (Lecture & Production)

## 1. Vue d'Ensemble et Flux Réel Actuel

### 1.1. Ingestion et Entrée en Production

- **Commande et Paiement** : Lorsqu'une commande passe au statut `PAID` (après confirmation Stripe), elle apparaît dans la colonne « Nouvelles » (`paid`) du Board Kanban ([KanbanBoard.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/kanban/KanbanBoard.tsx)).
- **Prise en charge (Assignation)** : L'expert clique sur « Prendre en charge » -> appel `POST /api/expert/orders/:id/assign`. L'attribution est inscrite dans la structure JSON `Order.expertReview` (`{ assignedBy, assignedName, assignedAt }`) et notifiée via WebSocket (`order:claimed`).

### 1.2. Lancement et Génération IA

- **Bouton Board / Kanban Drag** :
  - Le bouton « Lancer » sur une carte Kanban appelle `POST /api/expert/orders/:id/jobs/reading` (job asynchrone géré par le worker via `ProductionControlService`).
  - Le glisser-déposer vers la colonne « En cours » (`processing`) appelle `POST /api/expert/orders/:id/generate` (exécute `generateReading` directement et de manière synchrone dans l'API).
- **Studio - Étape Briefing** :
  - Dans [OrderWorkflow.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/OrderWorkflow.tsx) (Étape 2: Briefing via `StepBriefing.tsx`), l'expert peut renseigner des instructions personnalisées (`expertPrompt`, `expertInstructions`) puis cliquer sur « Lancer la lecture », ce qui appelle `POST /api/expert/process-order`.
- **Moteur IA (`VertexOracle.ts` & `DigitalSoulService.ts`)** :
  - **SCRIBE** : Génère la lecture et la synthèse structurée.
  - **GUIDE** : Génère le parcours pratique sur 30 jours (timeline) par lots.
  - Le résultat final est sérialisé dans le cache `Order.generatedContent`.
  - Émission de l'événement socket `order:generation-complete`.

### 1.3. Révision et Édition dans le Studio

- **Accès au Studio** : L'expert ouvre la route `/admin/studio/:orderId`.
- **Conversion du Contenu** : La fonction `oracleResponseToHtml(data.generatedContent)` convertit le champ JSON `pdf_content` en balises HTML (`<h1>`, `<h2>`, `<p>`, `<ul>`) pour charger l'éditeur Rich Text Tiptap ([TiptapEditor.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/TiptapEditor.tsx)).
- **Autosave Brouillon** : Pendant la saisie, un temporisateur de 2000 ms déclenche `PATCH /api/expert/orders/:id/draft` (`saveOrderDraft`).
- **Affinage et Assistant IA** :
  - `POST /api/expert/orders/:id/refine` pour affiner une sélection de texte dans l'éditeur.
  - `POST /api/expert/orders/:id/chat` via [AIAssistant.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/AIAssistant.tsx) pour dialoguer de manière contextuelle avec l'Oracle.

### 1.4. Scellement, PDF, E-mail et Audio

- **Finalisation / Scellement** :
  - L'expert clique sur « Sceller et envoyer » dans [StepRevision.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/StepRevision.tsx) -> Modal de confirmation -> `POST /api/expert/orders/:id/finalize` avec le corps `{ finalContent: editorHtml }`.
  - `ExpertService.finalizeFromStudio` :
    1. Parse le contenu HTML via `splitStudioContent` / `buildStudioReadingVersion`.
    2. Crée une entrée immuable dans la table `ReadingVersion` avec le statut `SEALED`, la version incrémentée et l'empreinte SHA-256 (`contentHash`).
    3. Génère le document PDF via Gotenberg (`digitalSoulService.finalizeWithPdf`).
    4. Bascule `Order.status = 'COMPLETED'` et renseigne `deliveredAt`.
    5. Envoie l'e-mail de livraison au client (`sendDeliveryEmail`).
    6. Ajoute la génération audio TTS à la file de traitement (`enqueueAudioBestEffort`).
- **Réouverture** :
  - Pour une commande `COMPLETED`, l'expert peut cliquer sur « Réouvrir » -> `POST /api/expert/orders/:id/reopen`. La commande repasse en statut `AWAITING_VALIDATION` pour réédition et nouveau scellement (créant une nouvelle `ReadingVersion`).

---

## 2. Source de Vérité à Chaque Étape

| Étape                       | Donnée / Objet                | Emplacement physique / Source de vérité                             |
| :-------------------------- | :---------------------------- | :------------------------------------------------------------------ |
| Ingestion & Intake          | Profil client & Questionnaire | `User.profile`, `Order.clientInputs`, `ReadingIntake`               |
| Prise en charge             | Assignation expert            | Champ JSON `Order.expertReview` (`assignedBy`, `assignedName`)      |
| État de production          | Statut du job & Worker        | Champ JSON `Order.expertReview` (`production` job state)            |
| Contenu temporaire IA       | Brouillon brut généré par LLM | Champ JSON `Order.generatedContent`                                 |
| Brouillon Studio            | Édition expert en cours       | HTML dans `Order.generatedContent` / `saveOrderDraft`               |
| Version Scellée (Canonique) | Lecture finale livrable       | Table PostgreSQL `ReadingVersion` (`status: SEALED`, `contentHash`) |
| Fichier PDF livré           | Document final client         | Storage S3 (`pdfKey` dans `DeliveryAsset` / `ReadingVersion`)       |
| Fichiers Audio              | Narration vocale TTS          | Storage S3 (chemins `audio/`)                                       |

---

## 3. Inventaire des Doublons

### 3.1. Endpoints de Lancement de Production

- `POST /api/expert/process-order` (route historique synchrone acceptant `expertPrompt`).
- `POST /api/expert/orders/:id/generate` (lancement synchrone direct `generateReading`).
- `POST /api/expert/orders/:id/generate-full` (alias pour `generateReadingWithPrompt`).
- `POST /api/expert/orders/:id/jobs/reading` (file asynchrone worker recommandée).

### 3.2. Endpoints de Validation et Scellement

- `POST /api/expert/validate-content` (ancienne route d'approbation).
- `POST /api/expert/orders/:id/validate` (ancienne route d'approbation studio).
- `POST /api/expert/orders/:id/finalize` (nouveau flux studio canonique avec scellement et Gotenberg).

### 3.3. Endpoints de Régénération

- `POST /api/expert/regenerate` (legacy, passe `orderId` dans le corps HTTP).
- `POST /api/expert/orders/:id/regenerate` (route RESTful avec paramètre d'URL).

### 3.4. Transformateurs et Mappings de Formats

- Côté Web : `oracleResponseToHtml` convertit la structure JSON `pdf_content` en balises HTML Tiptap (`<h1>`, `<h2>`, `<p>`).
- Côté Backend : `splitStudioContent` / `studioHtmlToText` ré-analyse le texte HTML pour reconstruire les sections `CanonicalPdfSection[]`.

---

## 4. Ruptures de Contrat Identifiées

1. **Incohérence des Déclencheurs de Production** :
   - Le bouton « Lancer » de la carte Kanban appelle `/jobs/reading`.
   - Le glisser-déposer Kanban vers la colonne « En cours » appelle `/generate`.
   - L'étape Briefing du Studio appelle `/process-order`.
   - _Conséquence_ : Le comportement de démarrage varie selon l'action UI effectuée par l'expert.

2. **Perte de Structure lors de l'Édition Rich Text** :
   - Le générateur IA produit des sections typées (`pdf_content.sections`).
   - Le Studio convertit ce contenu en un document HTML unique.
   - `splitStudioContent` utilise des expressions régulières (`line.startsWith('#')`, détection de majuscules) pour tenter de ré-identifier les titres de section.
   - _Conséquence_ : Si l'expert modifie les titres sans respecter la casse ou les balises reconnues, les sections risquent d'être regroupées ou déstructurées.

3. **Sérialisation d'État de Job dans un Champ JSON** :
   - L'état des travaux asynchrones est enregistré dans le champ JSON `Order.expertReview`.
   - En cas d'exécutions concurrentes ou sur plusieurs répliques API, cela expose à des conflits d'écriture sans verrou applicatif strict.

---

## 5. Risques de Perte de Contenu

1. **Autosave Asynchrone lors d'un Scellement Immédiat** :
   - L'autosave Tiptap s'exécute après un délai de 2000 ms. Si un expert modifie du texte et valide la modale de scellement très rapidement, l'HTML transmis dans `finalContent` est celui de l'état local React `editorContent`. Le scellement est correct, mais le brouillon stocké en base peut être temporairement en retard si une erreur survient pendant le scellement.
2. **Écrasement du Brouillon en cas de Régénération** :
   - L'appel à `regenerateOrder` sauvegarde la version actuelle dans l'historique des versions, mais remplace immédiatement `Order.generatedContent` par le nouveau flux IA.
3. **Absence de Secours en Cache Local Browser** :
   - En cas de perte de connexion réseau pendant la saisie, l'autosave échoue (statut « Non sauvegardé »). Un rafraîchissement manuel de la page entraîne la perte des modifications non synchronisées.

---

## 6. Composants et Endpoints à Conserver / Remplacer / Supprimer

### 6.1. À Conserver (Noyau Cible)

- **Modèle de données & Sécurité** : Table `ReadingVersion`, `CanonicalReadingContent`, scellement avec hash SHA-256 immuable.
- **Studio UI** : [OrderWorkflow.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/OrderWorkflow.tsx), [TiptapEditor.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/TiptapEditor.tsx), [AIAssistant.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/AIAssistant.tsx), `StepDossier.tsx`, `StepRevision.tsx`.
- **Worker Asynchrone** : `POST /api/expert/orders/:id/jobs/reading`, `ProductionControlService`, `ProductionControlController`.
- **Moteur PDF & Livraison** : `POST /api/expert/orders/:id/finalize`, `Gotenberg`, `DigitalSoulService.finalizeWithPdf`, `/api/readings/:orderNumber/file`.

### 6.2. À Remplacer / Normaliser

- **Normalisation du Lancement** : Alignement de l'ensemble de l'UI (Kanban et Studio Briefing) sur l'endpoint asynchrone unique `POST /api/expert/orders/:id/jobs/reading`.
- **Normalisation du Scellement** : Unification de toutes les validations d'expert sur `POST /api/expert/orders/:id/finalize`.
- **Normalisation de la Régénération** : Unification sur `POST /api/expert/orders/:id/regenerate`.
- **Format de Transfert Studio** : Sécurisation du parseur HTML <-> `CanonicalReadingContent` pour garantir zéro perte de section.

### 6.3. À Deprécier puis Supprimer en Dernier

- `POST /api/expert/process-order` (remplacé par `/jobs/reading`).
- `POST /api/expert/orders/:id/generate` et `/generate-full` (remplacés par `/jobs/reading`).
- `POST /api/expert/validate-content` et `POST /api/expert/orders/:id/validate` (remplacés par `/finalize`).
- `POST /api/expert/regenerate` (remplacé par `/orders/:id/regenerate`).

---

## 7. Matrice de Migration Sprint par Sprint

| Sprint                | Objectif Principal                     | Actions Clés                                                                                                                                               | Fichiers & Impact Code                                                                                                                                                                                                                                                                                                                             | Risque & Mitigation                                                                  |
| :-------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| **Sprint 1** (Actuel) | Baseline & Cartographie                | Documenter l'existant sans aucune modification applicative. Créer la branche de sauvegarde.                                                                | [docs/EXPERT_READING_REFACTOR_BASELINE.md](file:///c:/Users/hp/Desktop/Lumira%20V2/docs/EXPERT_READING_REFACTOR_BASELINE.md)                                                                                                                                                                                                                       | Aucun risque fonctionnel (documentation uniquement).                                 |
| **Sprint 2**          | Unification Lancement Production       | Rediriger le Kanban (bouton + drag) et le Studio (Briefing) vers `POST /api/expert/orders/:id/jobs/reading`. Désactiver les endpoints directes non worker. | [KanbanBoard.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/kanban/KanbanBoard.tsx), [OrderWorkflow.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/OrderWorkflow.tsx), [expert.controller.ts](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/api/src/modules/expert/expert.controller.ts) | Interruption du traitement worker -> Garder des interceptors de secours temporaires. |
| **Sprint 3**          | Édition Studio & Autosave Robuste      | Ajouter la résistance réseau (cache local de secours Tiptap), sécuriser le scellement immédiat et la détection de sections HTML.                           | [TiptapEditor.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/TiptapEditor.tsx), [reading-version.ts](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/api/src/modules/expert/reading-version.ts), [StepRevision.tsx](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/web/components/desk-v2/studio/StepRevision.tsx)     | Altération des sections -> Valider avec la suite de tests `reading-version.spec.ts`. |
| **Sprint 4**          | Nettoyage Backend & Legacy Deprecation | Supprimer les routes d'API obsolètes (`process-order`, `validate-content`), confirmer l'idempotence des opérations de scellement et de réouverture.        | [expert.controller.ts](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/api/src/modules/expert/expert.controller.ts), [expert.service.ts](file:///c:/Users/hp/Desktop/Lumira%20V2/apps/api/src/modules/expert/expert.service.ts)                                                                                                                       | Appels d'API clients restants -> Audit global des usages dans l'application.         |
| **Sprint 5**          | Recette E2E & Preuve par les Tests     | Exécuter la suite complète E2E (Kanban -> Briefing -> IA -> Édition -> Scellement -> PDF -> Audio -> Reopen).                                              | `tests/`, Playwright E2E specs                                                                                                                                                                                                                                                                                                                     | Régression silencieuse -> Validation par typecheck, build et suite E2E automatisée.  |
