---
name: lumira-sanctuaire-flow
description: Construire, corriger ou tester le parcours client Sanctuaire de Lumira : session post-checkout, lien magique, dossier scellé, lecture, audio/PDF, synthèse, demandes d’éclairage, profil et navigation mobile. À utiliser dès qu’une tâche touche `/sanctuaire`, l’auth client ou l’arrivée après paiement.
---

# Lumira — Parcours client Sanctuaire V1

## Source canonique

Lire avant toute modification :

- `docs/SANCTUAIRE_UX_UI_CANON_2026-07-22.md`
- `docs/AUDIT_UX_SANCTUAIRE_USER_AGENCY_2026-07-18.md`

Le Sanctuaire est un espace privé de transmission, de lecture et de suivi humain. Ce n’est ni un dashboard SaaS, ni une boutique, ni un jeu spirituel, ni un chatbot IA.

## Invariants produit

- L’accès provient d’une commande payée et de la logique d’entitlements existante.
- L’offre early V1 donne un accès de trois mois ; ne pas présenter cet accès comme lifetime ou permanent.
- Ne pas ajouter de renouvellement, upgrade, niveau ou catalogue tant que ces parcours ne sont pas réellement définis.
- Deux entrées sûres seulement : session serveur après vérification Stripe ou lien magique e-mail à usage unique.
- Une adresse inconnue ou sans commande payée ne doit pas obtenir de session.
- La réponse de demande de lien magique reste identique pour éviter l’énumération d’adresses.
- Le dossier scellé est l’instantané canonique utilisé pour la lecture concernée.
- Une fois la production démarrée, aucune modification silencieuse du dossier transmis.
- L’IA reste invisible côté client : aucun provider, modèle, agent, prompt ou réglage technique.
- La lecture est préparée avec assistance IA puis relue et validée humainement avant livraison.

## Architecture UX V1

### Navigation mobile permanente

Quatre destinations maximum :

1. Accueil ;
2. Lectures ;
3. Synthèse ;
4. Éclairage.

Le dossier reste accessible depuis l’accueil, le menu profil, les états vides et son URL protégée. Ne pas remettre un cinquième onglet mobile.

### Navigation desktop

- Accueil ;
- Mon dossier ;
- Mes lectures ;
- Ma synthèse ;
- Demander un éclairage ;
- Mon profil.

### Parcours de référence

1. Le client choisit ses informations.
2. Il relit et scelle son dossier.
3. Lumira prépare la lecture.
4. L’équipe relit et valide.
5. Le client reçoit le PDF et l’audio.
6. Il retrouve l’essentiel dans la synthèse.
7. Il peut demander un éclairage humain lié à son dossier.

Le délai client affiché pendant la préparation est de 24 à 48 heures.

## UX attendue

- Mobile-first, aucune navigation essentielle cachée hors écran.
- Une action principale évidente par écran.
- États explicites : chargement, brouillon, dossier scellé, préparation, relecture humaine, lecture prête, audio en préparation, vide, erreur réseau et session expirée.
- Ne pas faire clignoter un écran « accès protégé » avant de reconnaître une session valide.
- Préserver les textes saisis après une erreur récupérable.
- Utiliser des zones tactiles d’au moins 44 px.
- Garder les champs à 16 px minimum sur mobile.
- Conserver un focus visible et des annonces accessibles pour les changements asynchrones.
- Ne pas exposer les statuts techniques `PAID`, `PROCESSING`, `AWAITING_VALIDATION` ou `COMPLETED`.

## Design attendu

- Bleu abyssal, lumière horizon dorée, contraste fort et surfaces calmes.
- Playfair pour les titres, Inter pour l’interface.
- Étoiles discrètes uniquement.
- Aucun mandala interactif, niveau, badge de progression spirituelle, chemin de sept jours, rêves ou animation décorative continue dans la V1.
- Le lecteur audio devient prioritaire dès qu’une lecture est prête.
- Le PDF plein écran et son téléchargement restent deux actions distinctes.
- La synthèse est un raccourci ; elle ne remplace pas la lecture complète.
- « Demander un éclairage » est une messagerie humaine, pas un chatbot automatique.

## Fichiers à inspecter en priorité

- `apps/web/app/sanctuaire/`
- `apps/web/components/onboarding/ReadingPreparation.tsx`
- `apps/web/components/sanctuary/`
- `apps/web/context/SanctuaireAuthContext.tsx`
- `apps/web/context/SanctuaireContext.tsx`
- `apps/web/lib/sanctuaireApi.ts`
- `apps/web/lib/sanctuaireHomeState.ts`
- `apps/web/lib/sanctuaireNav.ts`
- `apps/web/middleware.ts`
- `packages/database/prisma/schema.prisma`

Rechercher les helpers de cookie, session, BFF et assets privés existants avant d’ajouter un nouveau stockage ou une nouvelle route.

## Sécurité et confidentialité

- Ne jamais accepter un e-mail seul comme preuve d’identité.
- Ne jamais exposer un endpoint public de handoff sans vérification Stripe interne.
- Ne pas stocker le token magique brut en base ou dans les logs.
- Préserver l’expiration, la consommation unique et les protections de rate limit.
- Ne jamais rendre une référence `s3://` directement au navigateur.
- Les photos visage et paume restent privées et facultatives.
- Utiliser `sanctuaireApi` pour les requêtes du Sanctuaire afin d’éviter la confusion avec le token expert.
- Tester les liens expirés, réutilisés, inconnus et concurrents.

## Critères d’acceptation

- Un nouvel acheteur payé arrive authentifié sur la vraie prochaine étape.
- Un client payé peut revenir par lien magique.
- Un client non payé reste refusé sans fuite d’information.
- Un lien ne fonctionne qu’une fois et expire correctement.
- Le refresh navigateur et la navigation mobile conservent la session.
- Les pages protégées ne rendent pas de données avant validation de la session.
- La barre mobile contient quatre destinations maximum.
- Le dossier reste accessible sans onglet mobile permanent.
- Le délai de 24 à 48 heures est visible pendant la préparation.
- La validation humaine est clairement mentionnée.
- L’audio est prioritaire lorsque la lecture est prête.
- Les tests API et Playwright couvrent au minimum les parcours nominal, expiré, non payé, brouillon, scellement, préparation et livraison.