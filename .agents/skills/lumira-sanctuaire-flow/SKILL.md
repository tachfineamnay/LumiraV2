---
name: lumira-sanctuaire-flow
description: Construire, corriger ou tester le parcours client Sanctuaire de Lumira : achat, session post-checkout, lien magique, onboarding, entitlements, navigation, contenus et accès mobile. À utiliser dès qu'une tâche touche `/sanctuaire`, l'auth client ou l'arrivée après paiement.
---

# Lumira — Parcours client Sanctuaire

## Invariants

- L'autorisation d'accès provient d'une commande payée et de la logique d'entitlements existante.
- Le Sanctuaire est un accès permanent ; ne pas remettre une logique d'abonnement résiliable dans l'UX ou les guards.
- Deux entrées sûres seulement : session serveur après vérification Stripe ou lien magique e-mail à usage unique.
- Une adresse inconnue ou sans commande payée ne doit pas obtenir de session.
- La réponse de demande de lien magique doit rester identique pour éviter l'énumération d'adresses.

## Fichiers à inspecter en priorité

- `apps/api/src/modules/auth/`
- `apps/api/src/modules/users/`
- `apps/api/src/modules/payments/`
- `apps/web/app/sanctuaire/`
- `apps/web/context/SanctuaireContext.tsx`
- `apps/web/lib/api.ts`
- `apps/web/middleware.ts`
- `packages/database/prisma/schema.prisma`

Rechercher les helpers de cookie et de session existants avant d'ajouter un nouveau stockage de token.

## Parcours de référence

### Nouvel acheteur

1. Pré-inscription minimale avant Stripe, sans délivrer de JWT.
2. Checkout créé côté serveur à partir d'un produit et d'un montant connus du serveur.
3. Au retour de Stripe, vérifier la session et son paiement côté serveur.
4. Créer ou retrouver l'utilisateur et la commande de façon idempotente.
5. Délivrer la session Sanctuaire uniquement après cette vérification.
6. Envoyer vers l'étape d'onboarding réellement incomplète, pas vers un écran de connexion intermédiaire.

### Client existant

1. Saisie e-mail.
2. Réponse générique immédiate.
3. Création d'un token aléatoire fort, stockage du hash uniquement, expiration courte.
4. Suppression ou invalidation des tokens actifs obsolètes selon la logique actuelle.
5. Consommation atomique une seule fois.
6. Création de la session client normale et redirection vers le bon écran.

## UX attendue

- Mobile-first, aucune navigation cachée hors écran.
- États explicites : chargement, lien envoyé, lien expiré, paiement non confirmé, profil incomplet, aucun contenu, erreur réseau.
- Ne pas faire clignoter un écran « accès protégé » avant de reconnaître une session valide.
- Conserver une navigation unique et cohérente entre accueil, lectures, chemin, rêves, chat, profil et préférences.
- Les capacités visibles doivent dériver des entitlements, pas de conditions dupliquées dans chaque page.

## Sécurité

- Ne jamais accepter un e-mail seul comme preuve d'identité.
- Ne jamais exposer un endpoint public qui appelle le handoff « paiement vérifié » sans vérification Stripe interne.
- Ne pas stocker le token magique brut en base ou dans les logs.
- Préserver l'expiration, la consommation unique et les protections de rate limit.
- Tester les liens expirés, réutilisés, inconnus et concurrents.

## Critères d'acceptation

- Un nouvel acheteur payé arrive authentifié sur le bon onboarding.
- Un client payé peut revenir par lien magique.
- Un client non payé reste refusé sans fuite d'information.
- Un lien ne fonctionne qu'une fois et expire correctement.
- Le refresh navigateur et la navigation mobile conservent la session.
- Les pages protégées ne rendent pas de données avant validation de la session.
- Les tests API et Playwright couvrent au moins les parcours nominal, expiré et non payé.
