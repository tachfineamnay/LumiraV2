# Runbook production — OpenAI, agents, Desk et PDF

Ce document décrit le chemin opérationnel V1 de Lumira :

`Desk → job persistant → agents OpenAI → generatedContent → validation expert → ReadingVersion SEALED → Gotenberg → S3 → DeliveryRecord`.

## 1. Configuration requise dans Coolify

Variables indispensables côté API :

```env
NODE_ENV=production
OPENAI_API_KEY=...
PRODUCTION_WORKER_ENABLED=true
PRODUCTION_WORKER_CONCURRENCY=2
PRODUCTION_WORKER_POLL_MS=2500
PRODUCTION_JOB_MAX_ATTEMPTS=3

GOTENBERG_URL=http://gotenberg:3000
GOTENBERG_TIMEOUT_MS=45000
GOTENBERG_MAX_ATTEMPTS=2

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-west-3
AWS_S3_BUCKET_NAME=...
AWS_UPLOADS_BUCKET_NAME=...
```

Ne jamais mettre les secrets dans GitHub. `GOTENBERG_URL` doit être joignable depuis le conteneur API ; dans un réseau Docker commun, utiliser le nom du service et non `localhost`.

## 2. Rôle réel des six agents

| Agent | Fonction | Déclenchement |
|---|---|---|
| SCRIBE | Lecture principale structurée + analyse visage/paume | Génération d'une lecture |
| GUIDE | Parcours pratique par lots de 10 jours | Après la synthèse SCRIBE |
| EDITOR | Affinage et correction du texte | Studio / demande expert |
| NARRATOR | Adaptation du texte validé pour l'audio | Production audio |
| CONFIDANT | Chat contextuel et mantra quotidien | Sanctuaire / assistant |
| ONIRIQUE | Interprétation structurée des rêves | Module rêves |

Les six agents utilisent OpenAI. Ils ne doivent pas être lancés tous dans la même requête : chaque agent intervient dans son workflow métier.

## 3. Génération depuis le Desk

Le Desk doit déposer un job, recevoir immédiatement :

```json
{
  "accepted": true,
  "jobId": "prod_...",
  "status": "QUEUED"
}
```

Le navigateur ne doit jamais attendre la réponse finale OpenAI sur la requête HTTP initiale. Le worker poursuit le traitement et le Desk récupère le résultat par WebSocket ou polling de la commande.

États attendus :

1. `PAID` — dossier prêt ;
2. job `QUEUED` ;
3. job `RUNNING`, commande `PROCESSING` ;
4. `generatedContent` enregistré ;
5. commande `AWAITING_VALIDATION` ;
6. expert révise et scelle ;
7. PDF livré, commande `COMPLETED`.

## 4. Contrôles OpenAI

Dans le Desk administrateur, vérifier :

- clé OpenAI détectée ;
- provider effectif `openai` pour chaque agent ;
- modèle effectif égal au modèle configuré ;
- prompt système résolu et non vide ;
- dernière exécution `AiRun` avec statut, durée, tokens et erreur éventuelle ;
- réponse structurée conforme au JSON Schema pour SCRIBE, GUIDE et ONIRIQUE.

Une réponse OpenAI réussie doit être persistée dans `Order.generatedContent` avant toute tentative PDF ou audio.

## 5. Contrôle PDF

Gotenberg doit répondre avec un vrai flux PDF dont les premiers octets sont `%PDF-`.

En cas de panne Gotenberg, réseau ou S3 après le scellement :

- la `ReadingVersion` scellée reste intacte ;
- la commande revient à `AWAITING_VALIDATION` ;
- `errorLog` commence par `[DELIVERY_RETRYABLE]` ;
- l'expert peut relancer la finalisation sans régénérer la lecture OpenAI.

## 6. Test de fumée après déploiement

Sur une commande de test complète :

1. ouvrir le dossier dans le Desk ;
2. lancer la production ;
3. vérifier que l'interface répond immédiatement et continue de suivre le job ;
4. attendre `AWAITING_VALIDATION` ;
5. vérifier que la lecture apparaît dans l'éditeur ;
6. modifier une phrase et sceller ;
7. télécharger le PDF et vérifier que les balises HTML ne sont pas imprimées ;
8. contrôler la présence du PDF dans S3 et du `DeliveryRecord` ;
9. vérifier l'email de livraison ;
10. contrôler les `AiRun` de SCRIBE et GUIDE dans le diagnostic IA.

## 7. Diagnostic rapide

### La commande reste en QUEUED

- vérifier `PRODUCTION_WORKER_ENABLED=true` ;
- vérifier les logs `Production worker started` ;
- lancer la récupération des jobs périmés depuis le contrôle de production.

### La commande passe en FAILED avant la lecture

- lire `order.errorLog` et l'erreur du job ;
- vérifier la clé OpenAI, les crédits, les limites et l'accès aux modèles ;
- vérifier que les photos privées sont accessibles depuis S3 ;
- relancer le job depuis le contrôle de production.

### La lecture existe mais pas le PDF

- vérifier `GOTENBERG_URL` depuis le conteneur API ;
- vérifier le conteneur Gotenberg et son réseau ;
- vérifier les variables S3 ;
- relancer la finalisation : la lecture scellée ne doit pas être régénérée.
