---
name: lumira-expert-desk
description: Développer, réparer ou auditer le Desk expert Lumira : authentification admin, CRM clients, commandes, Kanban, génération, revue, validation, livraison, prompts, routing IA et paramètres. À utiliser pour toute tâche sous `/admin` ou liée au travail opérationnel des experts.
---

# Lumira — Desk expert et production

## Objectif

Faire du Desk un outil opérationnel fiable permettant à un expert de suivre une commande depuis le paiement jusqu'à la livraison, sans accès aux données d'un autre rôle et sans états impossibles.

## Frontières d'authentification

- Utiliser exclusivement l'auth expert et les guards/rôles existants pour le Desk.
- Ne jamais accepter un token client sur une route expert ni exposer des secrets de configuration au navigateur.
- Les actions sensibles doivent être autorisées côté API, même si le bouton est masqué côté UI.
- Conserver la distinction `EXPERT` / `ADMIN` pour les opérations réservées aux réglages globaux.

## Modules à inspecter

- `apps/web/app/admin/`
- `apps/web/components/desk-v2/`
- `apps/api/src/modules/expert/`
- `apps/api/src/modules/orders/`
- `apps/api/src/modules/client/`
- `apps/api/src/modules/settings/`
- `apps/api/src/services/factory/`
- `packages/database/prisma/schema.prisma`

## Workflow de commande

Respecter une machine d'état explicite autour de :

`PENDING → PAID → PROCESSING → AWAITING_VALIDATION → COMPLETED`

avec sorties contrôlées vers `FAILED`, `REFUNDED` ou une révision.

Pour chaque transition :

1. vérifier l'état source autorisé ;
2. effectuer les écritures liées dans une transaction si nécessaire ;
3. enregistrer l'erreur exploitable sans données sensibles ;
4. éviter qu'un double clic ou retry déclenche deux générations ou deux livraisons ;
5. rafraîchir le Desk depuis la donnée serveur, pas par simulation locale durable.

## Revue et validation

- Afficher clairement les données client, fichiers, produit, contenu généré, versions et historique.
- Distinguer instructions expert, contenu IA brut, contenu révisé et contenu validé.
- Une validation finale doit persister l'état avant de lancer les effets secondaires de livraison.
- Les révisions doivent incrémenter ou tracer une version, sans écraser silencieusement l'historique utile.
- Les erreurs de PDF, audio, S3 ou e-mail doivent être visibles et relançables de manière idempotente.

## Paramètres et IA

- Les secrets administrables doivent passer par `SystemSetting` et le mécanisme de chiffrement existant ; ne jamais les renvoyer en clair au client.
- Les prompts doivent utiliser `PromptVersion` avec une seule version active par clé.
- Le routing doit utiliser `AiRoutingRule` et respecter le triplet produit × agent × mission.
- Toute modification de modèle, température, tokens ou prompt doit être validée côté API.
- Prévoir des valeurs de repli explicites et observables lorsque la configuration est incomplète.

## UX Desk

- Prioriser lisibilité, densité maîtrisée et actions évidentes plutôt que l'effet visuel.
- Prévoir chargement, vide, erreur, retry, confirmation destructive et feedback de succès.
- Le Desk doit rester utilisable sur petit écran, même si le desktop est prioritaire.
- Ne pas dupliquer les données d'une commande dans plusieurs stores non synchronisés.

## Critères d'acceptation

- Un expert peut retrouver un client et sa commande, comprendre l'état et agir sans deviner.
- Les transitions invalides sont refusées côté serveur.
- Un retry n'engendre pas de doublon de génération, fichier ou notification.
- Les paramètres sensibles ne sont jamais exposés en clair.
- Les changements de prompt/routing sont versionnés et testables.
- Les tests couvrent au minimum la transition principale, une transition interdite, une révision et un échec de livraison.
