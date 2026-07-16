---
name: lumira-ai-content-pipeline
description: Concevoir, corriger ou tester la chaîne IA Lumira : routing produit × agent × mission, Gemini/Vertex/OpenAI, prompts versionnés, lecture, insights, chemin, rêves, chat, PDF, audio et persistance. À utiliser dès qu'une tâche touche VertexOracle, les agents, les modèles ou la génération de contenu.
---

# Lumira — Pipeline IA, contenus et livrables

## Principe

L'IA est un composant d'un workflow transactionnel, pas une fonction isolée. Toute génération doit être routée, validée, persistée, observable, relançable et compatible avec la revue expert.

## Architecture à inspecter

- `apps/api/src/services/factory/VertexOracle.ts`
- `apps/api/src/services/factory/ContextDispatcher.ts`
- `apps/api/src/services/factory/DigitalSoulService.ts`
- `apps/api/src/services/factory/PdfFactory.ts`
- services audio/TTS dans `apps/api/src/services/factory/`
- modules `orders`, `insights`, `dreams`, `chat`, `settings`
- `PromptVersion`, `AiRoutingRule`, `Order`, `Insight`, `SpiritualPath`, `PathStep`, `Dream`, `AkashicRecord`

## Agents et missions

Préserver les responsabilités distinctes :

- `SCRIBE` : lecture principale ;
- `GUIDE` : chemin et étapes ;
- `EDITOR` : révision contrôlée ;
- `CONFIDANT` : conversation contextualisée ;
- `ONIRIQUE` : interprétation de rêves ;
- `NARRATOR` : préparation audio.

Le routing doit résoudre explicitement le triplet `ProductLevel × agent × AiMission`, puis fournir provider, modèle, température, limite de tokens et éventuelle version de prompt. Toute règle de fallback doit être déterministe et journalisée.

## Entrées

- Construire le contexte depuis les données serveur autorisées.
- Ne pas faire confiance à un niveau produit, un rôle ou un identifiant transmis par le navigateur sans vérification.
- Minimiser les données personnelles envoyées au provider et ne jamais inclure secret ou URL privée inutile.
- Pour les images, vérifier type, taille, accès et erreurs avant l'appel multimodal.

## Sorties

- Demander une structure JSON explicite lorsque le workflow l'exige.
- Parser et valider avec un schéma strict avant persistance.
- Refuser ou réparer de manière contrôlée les réponses tronquées, invalides ou hors format ; ne pas stocker un faux succès.
- Séparer contenu brut, contenu révisé, synthèse et métadonnées.
- Éviter les affirmations médicales, diagnostiques, juridiques ou fatalistes.

## Idempotence et états

1. Vérifier l'état de commande avant génération.
2. Utiliser un verrou logique, une contrainte ou une transition atomique pour empêcher deux générations concurrentes.
3. Persister le résultat principal avant PDF, audio, e-mail ou notification.
4. Rendre chaque effet secondaire relançable sans doublon.
5. En cas d'échec, conserver une erreur exploitable et un état permettant le retry.

## PDF, audio et stockage

- Le PDF doit être généré à partir du contenu validé, jamais d'une réponse IA non contrôlée.
- Échapper les données injectées dans Handlebars et vérifier la compatibilité Gotenberg.
- Le stockage S3 doit utiliser les helpers existants, des clés stables et le bon niveau de visibilité.
- L'audio doit partir du texte final, tracer la voix choisie et ne pas bloquer silencieusement la livraison principale.
- Une URL signée ou temporaire ne doit pas être persistée comme URL permanente.

## Tests requis

Utiliser des doubles déterministes pour les providers externes et couvrir :

- règle de routing exacte et fallback ;
- JSON valide, JSON invalide et réponse tronquée ;
- provider indisponible ou rate limit ;
- double déclenchement concurrent ;
- persistance réussie avec échec PDF/audio ;
- révision expert puis livraison du contenu révisé ;
- contrôle du niveau produit et des entitlements.

## Critères d'acceptation

- Une commande ne produit qu'un workflow cohérent malgré les retries.
- Le Desk peut comprendre et relancer un échec.
- Le client ne voit que du contenu validé et autorisé.
- Les prompts et règles utilisés sont identifiables a posteriori.
- Aucun provider ou modèle n'est codé en dur en contournant la matrice active sans justification explicite.
