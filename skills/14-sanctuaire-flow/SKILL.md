---
name: Sanctuaire User Flow
description: Parcours client Lumira V1, du paiement à la préparation du dossier, à la livraison PDF/audio, à la synthèse et aux demandes d’éclairage humain.
---

# Sanctuaire Lumira — parcours client V1

## Références obligatoires

- `docs/SANCTUAIRE_UX_UI_CANON_2026-07-22.md`
- `docs/AUDIT_UX_SANCTUAIRE_USER_AGENCY_2026-07-18.md`
- `.agents/skills/lumira-sanctuaire-flow/SKILL.md`

Ces documents remplacent l’ancien concept de portail à quatre niveaux, chemin spirituel de sept jours, rêves, cartes d’insights et chat Oracle automatique.

## Produit actuel

Le Sanctuaire est l’espace privé où le client :

1. prépare les informations utiles à sa lecture ;
2. conserve un brouillon serveur ;
3. relit et scelle explicitement son dossier ;
4. suit la préparation et la validation humaine ;
5. reçoit une lecture PDF et audio ;
6. retrouve une synthèse courte ;
7. échange avec l’équipe au moyen de demandes d’éclairage.

L’offre early V1 donne un accès de trois mois au prix défini par le catalogue serveur. Ne pas présenter l’accès comme permanent, lifetime, résiliable ou organisé en niveaux.

## Architecture de référence

```text
Paiement confirmé
      ↓
Session Sanctuaire ou lien magique
      ↓
Dossier en brouillon
      ↓
Relecture et scellement
      ↓
Préparation assistée par IA
      ↓
Validation humaine
      ↓
PDF + audio + synthèse
      ↓
Demandes d’éclairage humain
```

## Navigation V1

### Mobile

- Accueil
- Lectures
- Synthèse
- Éclairage

Le dossier reste accessible depuis l’accueil et le menu profil, sans cinquième onglet permanent.

### Desktop

- Accueil
- Mon dossier
- Mes lectures
- Ma synthèse
- Demander un éclairage
- Mon profil

## États client

### Dossier à préparer

- Le client choisit ce qu’il transmet.
- Les données restent modifiables jusqu’au scellement.
- Les photos visage et paume sont facultatives et privées.
- Le CTA final est « Sceller et transmettre mon dossier ».

### Lecture en préparation

- Le dossier est reçu.
- Le délai habituel affiché est de 24 à 48 heures.
- Aucune action supplémentaire n’est demandée.
- Le client peut revoir l’instantané transmis.
- Une notification est envoyée lorsque la lecture est prête.

### Lecture prête

Priorité d’interface :

1. lecteur audio ;
2. lecture plein écran ;
3. téléchargement PDF ;
4. synthèse ;
5. demande d’éclairage.

## Source de vérité des données

Après scellement, la source canonique de la lecture est l’instantané stocké dans :

```text
Order.clientInputs.readingIntake.profile
```

Le profil courant ne doit pas être fusionné silencieusement avec un dossier déjà scellé.

Les photos privées utilisent des références durables `s3://onboarding/{userId}/...`, mais le navigateur ne reçoit jamais ces références directement. Les fichiers sont servis par des routes protégées.

## Règles UX/UI

- Une action principale par écran.
- Aucun statut technique exposé.
- Aucun choix de modèle, provider, agent ou prompt côté client.
- Aucune boutique, upgrade, niveau ou catalogue dans le Sanctuaire.
- Aucun mandala interactif, chemin de sept jours, journal de rêves ou chatbot Oracle dans la navigation V1.
- Le texte reste calme, direct, humain et non déterministe.
- Le sens ne dépend pas uniquement de la couleur.
- Toutes les actions tactiles font au moins 44 px.
- Les formulaires utilisent une taille de texte évitant le zoom automatique mobile.
- Les erreurs récupérables ne suppriment pas les textes saisis.
- Les pages disposent d’états chargement, vide, erreur et reprise.

## Authentification

Deux entrées seulement :

1. session créée après vérification serveur d’un paiement Stripe confirmé ;
2. lien magique e-mail aléatoire, hashé, expirant et consommable une seule fois.

Ne jamais :

- authentifier sur la seule base d’un e-mail ;
- accepter une commande `PENDING` comme paiement confirmé ;
- mélanger le token expert et le token Sanctuaire ;
- exposer le token magique ou les références S3 dans les logs.

## API et composants actuels

Inspecter le code réel avant toute modification, en priorité :

```text
apps/web/app/sanctuaire/
apps/web/components/onboarding/ReadingPreparation.tsx
apps/web/components/sanctuary/
apps/web/context/SanctuaireAuthContext.tsx
apps/web/context/SanctuaireContext.tsx
apps/web/lib/sanctuaireApi.ts
apps/web/lib/sanctuaireHomeState.ts
apps/web/lib/sanctuaireNav.ts
apps/api/src/modules/auth/
apps/api/src/modules/client/
packages/database/prisma/schema.prisma
```

Ne pas réintroduire les anciens exemples d’API, composants, niveaux ou capacités sans vérifier leur existence dans la branche `main`.

## Critères de validation

- Paiement confirmé avant création de session.
- Reprise du brouillon après refresh ou retour ultérieur.
- Scellement transactionnel et non répétable après production.
- Photos privées visibles uniquement par leur propriétaire et l’expert autorisé.
- Statut client cohérent entre accueil, dossier et lectures.
- Navigation mobile limitée à quatre destinations.
- Délai de 24 à 48 heures visible pendant la préparation.
- PDF et audio accessibles une fois validés.
- Synthèse clairement présentée comme un raccourci.
- Messagerie présentée comme un échange humain.
- Tests API, typecheck, build et Playwright exécutés avant déploiement lorsque l’environnement le permet.