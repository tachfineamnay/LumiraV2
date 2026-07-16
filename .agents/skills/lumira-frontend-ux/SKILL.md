---
name: lumira-frontend-ux
description: Concevoir, réparer ou harmoniser l'interface Lumira sous Next.js 14 : landing, checkout, Sanctuaire, Desk, responsive mobile, accessibilité, états UI, API client et design system. À utiliser pour toute tâche frontend ou parcours visuel multi-écrans.
---

# Lumira — Frontend et expérience utilisateur

## Architecture

- Next.js 14 App Router, React 18 et TypeScript strict.
- Respecter les frontières Server Component / Client Component.
- Utiliser les layouts et providers existants ; ne pas recréer un deuxième shell de navigation.
- Utiliser `apps/web/lib/api.ts` et les helpers d'auth existants pour les appels protégés.
- Vérifier `apps/web/tailwind.config.js`, `@packages/ui` et les composants locaux avant d'ajouter de nouveaux tokens ou primitives.

## Règles de conception

- Mobile-first : commencer à 320–390 px puis vérifier tablette et desktop.
- Préserver l'identité Lumira existante : profondeur sombre, accents or/horizon, lisibilité claire, animation mesurée.
- La hiérarchie et la compréhension priment sur le glassmorphism ou les effets décoratifs.
- Une action principale par écran ou section critique.
- Ne pas masquer une fonctionnalité essentielle derrière un hover inaccessible au tactile.
- Éviter les hauteurs fixes qui coupent le contenu, en particulier avec clavier mobile et `svh`.

## États obligatoires

Chaque vue asynchrone doit gérer :

- chargement stable sans saut majeur ;
- vide utile avec prochaine action ;
- erreur compréhensible avec retry ;
- succès confirmé ;
- session expirée ou accès refusé ;
- données partielles ou contenu en cours de production.

Ne jamais afficher une page blanche, un spinner infini ou une fausse réussite après une erreur API.

## Données et état

- La donnée serveur reste la source de vérité pour auth, entitlements, commande et contenu.
- Éviter de dupliquer la même ressource dans plusieurs contexts/stores non synchronisés.
- Annuler ou ignorer les réponses obsolètes lorsqu'une navigation ou recherche change.
- Invalider ou rafraîchir après mutation plutôt que bricoler un état local incohérent.
- Ne pas exposer secret, configuration provider ou donnée d'un autre utilisateur dans les props client.

## Formulaires

- Utiliser les bibliothèques déjà présentes : React Hook Form, Zod et composants existants.
- Validation utile côté client, validation autoritative côté API.
- Conserver les saisies après erreur récupérable.
- Désactiver et protéger les doubles soumissions.
- Compresser et valider les images sans dégrader les contrôles serveur.
- Afficher les contraintes de fichier avant upload.

## Accessibilité

- HTML sémantique, labels explicites, ordre de tabulation logique.
- Focus visible et restauré après modal/navigation.
- Modales avec focus trap, fermeture clavier et confirmation adaptée.
- Contraste suffisant pour texte, boutons et états désactivés.
- Respecter `prefers-reduced-motion` pour les animations non essentielles.
- Icônes seules accompagnées d'un nom accessible.

## Tests visuels et comportementaux

Vérifier au minimum :

- 375 × 812, 768 × 1024 et desktop large ;
- navigation clavier ;
- contenu long en français ;
- erreurs API et réseau lent ;
- session expirée ;
- upload mobile ;
- retour navigateur et refresh ;
- aucun overflow horizontal involontaire.

Utiliser Playwright pour les parcours critiques. Les snapshots seuls ne remplacent pas les assertions de comportement.

## Critères d'acceptation

- Le parcours est compréhensible sans explication externe.
- Les écrans restent utilisables sur mobile et avec contenu réel long.
- Les états d'erreur permettent une récupération.
- Auth et entitlements ne clignotent pas ou ne fuient pas du contenu protégé.
- Les composants réutilisent le design system et évitent la duplication.
- Les tests couvrent l'action principale et au moins un échec réaliste.
