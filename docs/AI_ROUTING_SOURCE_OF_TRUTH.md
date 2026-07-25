# AI Routing Source of Truth (Source de Vérité du Routage IA)

Ce document décrit l'architecture de routage des requêtes IA au sein du runtime de Lumira V2.

## Source de vérité actuelle : `MODEL_CONFIG` par Agent

Le runtime de Lumira V2 détermine le modèle, le fournisseur (OpenAI, Gemini via Developer API, ou Vertex AI) et les paramètres de génération (comme le niveau de réflexion/thinkingLevel) en lisant exclusivement la configuration unifiée stockée sous la clé de configuration `MODEL_CONFIG`.

Chaque agent actif (`SCRIBE`, `GUIDE`, `EDITOR`, `NARRATOR`, `CONFIDANT`, `ONIRIQUE`) possède sa propre configuration dans le dictionnaire `agents` de `MODEL_CONFIG`.

**Le résolveur (`AiExecutionResolverService`) utilise uniquement cette configuration locale par agent.**

---

## Statut des règles de routage (`AiRoutingRule` / `AiRoutingService`)

### Historique / Inactif dans le runtime

La table de base de données `AiRoutingRule` (gérée via la classe `AiRoutingService`) permet d'associer un modèle et un fournisseur à un couple spécifique d'un niveau produit (`ProductLevel`) et d'une mission (`AiMission`).

**Cette table et les routes associées sont actuellement inactives et ignorées lors de l'exécution des agents.**

L'injection morte d'`AiRoutingService` a été retirée du résolveur de production (`AiExecutionResolverService`) pour éviter toute confusion. La table Prisma `AiRoutingRule` et les interfaces associées dans le Desk expert (écrans de configuration) restent présentes en base de données pour préserver l'historique et la compatibilité future, mais ne participent pas à l'exécution.

---

## Aucun routage par `ProductLevel` ou `AiMission`

Le routage dynamique basé sur le niveau d'accès du client (`ProductLevel`) ou la mission de l'agent (`AiMission`) n'est pas utilisé actuellement. Toutes les requêtes pour un agent donné passent par le modèle explicitement validé et configuré pour cet agent dans `MODEL_CONFIG`.

La valeur du champ `routingSource` enregistré dans l'historique d'exécution (`AiRun`) est explicitement :

```
model-config:<AGENT>
```

(Exemple : `model-config:SCRIBE`, `model-config:GUIDE`, etc.) au lieu de `global:<AGENT>`, confirmant que le routage provient uniquement du bloc de configuration par agent.

---

## Procédure future pour réactiver la matrice mission / produit

Si l'équipe produit décide de réintroduire un routage dynamique basé sur le niveau produit (`ProductLevel`) ou la mission (`AiMission`), voici les étapes techniques requises :

1. **Ré-injection d'un résolveur dynamique** :
   Ré-injecter `AiRoutingService` (ou un service similaire) dans `AiExecutionResolverService`.

2. **Évaluation prioritaire des règles** :
   Dans la méthode `resolve()`, interroger les règles actives :

   ```typescript
   const customRule = await this.aiRouting.resolveRule({
     mission: ctx.mission,
     productLevel: ctx.productLevel,
   });
   ```

3. **Fallback ordonné** :
   - Si une règle personnalisée/active est trouvée, l'appliquer en priorité et positionner `routingSource` à `rule:<PRODUCT_LEVEL>/<AGENT>/<MISSION>`.
   - Si aucune règle n'est trouvée pour cette mission/ce produit, faire un fallback sur la configuration par défaut de l'agent définie dans `MODEL_CONFIG` (et positionner `routingSource` à `model-config:<AGENT>`).

4. **Validation des capacités** :
   S'assurer que les modèles dynamiquement résolus passent toujours les gardes obligatoires de réflexion (`assertExecutableAgentModel`) et les preuves de capacités réelles (`assertValidatedAgentCapabilities`).
