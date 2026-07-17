# Demandes d’éclairage — contrat Desk / Sanctuaire

## Objectif

Une demande d’éclairage est un échange adressé au Desk à propos d’une lecture ou d’une situation précise. Elle est séparée du chat IA historique.

Le contrat API est volontairement indépendant du stockage. La première version utilise `ChatSession` comme adaptateur compatible ; une migration future vers `Conversation` et `Message` pourra être réalisée sans changer les routes ni les composants consommateurs.

## Séparation des usages

### Chat IA historique

- route existante : `POST /api/client/chat` ;
- réponses automatiques du confident Lumira ;
- stockage historique dans `ChatSession.messages` sous forme `{ role, content, timestamp }` ;
- ne doit jamais apparaître dans l’inbox humaine du Desk.

### Demande d’éclairage

- question réellement envoyée au Desk ;
- réponse d’un expert ;
- assignation, non-lus et statut ;
- liée facultativement à une lecture ;
- stockée temporairement dans `ChatSession.messages` avec un marqueur de version explicite.

## Statuts

```text
NEW
IN_PROGRESS
WAITING_EXPERT
WAITING_CLIENT
RESOLVED
ARCHIVED
```

Transitions usuelles :

```text
Client crée         → NEW
Expert prend        → IN_PROGRESS
Client écrit        → WAITING_EXPERT
Expert répond       → WAITING_CLIENT
Expert résout       → RESOLVED
Expert rouvre       → IN_PROGRESS
```

## Catégories

```text
READING_CLARIFICATION
SPECIFIC_SITUATION
INTEGRATION_ADVICE
OTHER
```

## Routes client

Toutes les routes utilisent la session Sanctuaire normale et ne retournent que les demandes du client connecté.

### Lister

```http
GET /api/client/requests
```

### Créer

```http
POST /api/client/requests
Content-Type: application/json

{
  "subject": "Clarifier un passage de ma lecture",
  "content": "Je souhaite mieux comprendre le passage concernant...",
  "category": "READING_CLARIFICATION",
  "relatedOrderId": "optional-order-id"
}
```

Une commande payée est obligatoire. L’accès permanent reste la source d’autorisation.

### Ouvrir

```http
GET /api/client/requests/:id
```

### Répondre

```http
POST /api/client/requests/:id/messages
Content-Type: application/json

{ "content": "Voici la précision demandée..." }
```

### Marquer lu

```http
POST /api/client/requests/:id/read
```

## Routes Desk

### Inbox

```http
GET /api/expert/requests?status=WAITING_EXPERT&assignedTo=mine&unreadOnly=true
```

Filtres facultatifs :

- `status` ;
- `assignedTo=mine` ;
- `assignedTo=unassigned` ;
- `unreadOnly=true` ;
- `limit`.

### Ouvrir

```http
GET /api/expert/requests/:id
```

### Prendre en charge

```http
POST /api/expert/requests/:id/assign
```

### Répondre

```http
POST /api/expert/requests/:id/messages
Content-Type: application/json

{ "content": "Réponse experte..." }
```

### Changer le statut

```http
PATCH /api/expert/requests/:id/status
Content-Type: application/json

{ "status": "RESOLVED" }
```

### Marquer lu

```http
POST /api/expert/requests/:id/read
```

## Réponse canonique

```json
{
  "id": "request-id",
  "subject": "Clarifier un passage",
  "status": "WAITING_CLIENT",
  "category": "READING_CLARIFICATION",
  "priority": "NORMAL",
  "assignedExpert": {
    "id": "expert-id",
    "name": "Grégory"
  },
  "relatedReading": {
    "id": "order-id",
    "orderNumber": "LUM-2026-0001"
  },
  "unreadCount": 1,
  "messageCount": 2,
  "lastSender": "EXPERT",
  "lastMessageAt": "2026-07-17T15:00:00.000Z",
  "messages": []
}
```

Le champ `messages` est présent uniquement sur le détail.

## Intégration Sanctuaire

La page « Demander un éclairage » doit utiliser ces routes, et non `POST /client/chat`.

Structure recommandée :

```text
Demandes d’éclairage
├── Nouvelle demande
├── Une réponse vous attend
├── En attente de votre précision
└── Terminées
```

Le client peut choisir :

- aucune lecture particulière ;
- une lecture de son historique.

Wording :

- `Nouvelle demande`
- `En cours de lecture`
- `Une réponse vous attend`
- `En attente de votre précision`
- `Terminée`

Ne jamais afficher les termes internes `ticket`, `SLA`, `queue`, `job` ou `incident`.

## Notifications

Lorsqu’un expert répond :

- une notification Sanctuaire générique est créée ;
- aucun contenu privé n’est copié dans les métadonnées ;
- le client retrouve le texte uniquement après authentification dans la demande.

L’e-mail transactionnel pourra être branché ultérieurement sur le même événement, avec une clé d’idempotence dédiée.

## Limites P0

- stockage adapté sur `ChatSession` ;
- pas encore de pièce jointe ;
- pas encore de brouillon IA expert ;
- notification utilisateur créée après l’écriture du message, sans outbox transactionnelle ;
- polling Desk toutes les quelques secondes, WebSocket optionnel plus tard.

## Migration future

La migration vers des tables `Conversation` et `Message` devra :

1. créer les tables normalisées ;
2. migrer uniquement les sessions marquées `LUMIRA_EXPERT_REQUEST_V1` ;
3. conserver les identifiants externes ou une table de correspondance ;
4. remplacer l’implémentation du service ;
5. garder toutes les routes et DTO ci-dessus inchangés ;
6. conserver l’ancien chat IA dans son propre flux.
