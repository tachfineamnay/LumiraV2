---
name: lumira-finish-project
description: Finir, auditer, prioriser et implémenter Lumira V2 jusqu'au lancement. À utiliser pour les demandes de type « termine le projet », audit global, P0/P1, launch readiness, backlog technique ou exécution autonome multi-modules. Ne pas utiliser pour une micro-correction isolée déjà précisément définie.
---

# Lumira — Orchestrateur de finalisation

## Objectif

Transformer une demande large en progression réelle du produit, avec une priorisation fondée sur les parcours critiques et des preuves de validation.

## Démarrage obligatoire

1. Lire `AGENTS.md`.
2. Inspecter `package.json`, les packages concernés, le schéma Prisma et les tests existants.
3. Vérifier `git status --short`, la branche et le diff non commité.
4. Établir un baseline avec les contrôles ciblés les moins coûteux : génération Prisma, typecheck ou tests du module concerné.
5. Ne pas considérer les anciens fichiers `skills/` comme source de vérité sans confrontation au code actuel.

## Cartographie des parcours critiques

Évaluer au minimum ces parcours :

1. visiteur → choix produit → checkout Stripe ;
2. paiement confirmé → compte client → session Sanctuaire ;
3. onboarding → collecte des données et médias ;
4. génération IA → persistance → revue expert ;
5. validation → PDF/audio → livraison ;
6. retour client → lien magique → accès durable au Sanctuaire ;
7. expert → Desk → commandes, clients, prompts, routing et paramètres ;
8. déploiement → migrations → healthchecks → observabilité.

## Priorisation

Classer chaque constat avec une preuve de code ou de test :

- **P0** : empêche achat, connexion, génération, validation, livraison, sécurité ou déploiement.
- **P1** : parcours fonctionnel mais incomplet, fragile, confus ou non testable.
- **P2** : amélioration de qualité, dette ou optimisation sans blocage immédiat.

Traiter les P0 avant toute amélioration visuelle ou refactor non bloquant.

## Boucle d'exécution

Pour chaque tranche verticale :

1. Définir le comportement attendu et les critères d'acceptation.
2. Identifier UI, API, modèles, effets externes et tests concernés.
3. Implémenter le changement minimal cohérent de bout en bout.
4. Ajouter ou corriger les tests de régression.
5. Exécuter les contrôles ciblés.
6. Rechercher les régressions dans les parcours voisins.
7. Continuer sur le P0 suivant tant que la demande autorise une exécution globale.

Ne pas s'arrêter à un simple rapport lorsque la demande demande explicitement de finir ou réparer le projet et que le code peut être modifié.

## Règles de décision

- Préférer une correction de cause racine à un contournement UI.
- Ne pas dupliquer une logique d'autorisation, d'entitlement, de routing IA ou de calcul de statut.
- Ne pas introduire une nouvelle dépendance de production sans bénéfice net et sans vérifier qu'une solution existe déjà dans le repo.
- Ne pas modifier simultanément plusieurs architectures sans tests qui prouvent le comportement.
- Si une migration destructive est nécessaire, produire une stratégie de transition réversible.

## Validation finale

Exécuter, selon le périmètre :

```bash
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

Un `passWithNoTests` n'est pas une preuve suffisante pour un nouveau flux critique : ajouter au moins un test comportemental pertinent.

## Compte rendu attendu

Terminer avec :

- résultat produit obtenu ;
- fichiers et modules modifiés ;
- commandes réellement exécutées et résultat ;
- P0/P1 restant, avec preuve et prochaine action exacte ;
- risques non vérifiés, sans masquer les limitations de l'environnement.
