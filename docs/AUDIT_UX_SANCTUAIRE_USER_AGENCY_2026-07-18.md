# Audit UX/UI du Sanctuaire — contrôle utilisateur et scellement du dossier

**Date :** 18 juillet 2026  
**Branche :** `codex/sanctuaire-user-agency-sealing`  
**Périmètre :** accueil, préparation initiale, dossier, navigation, lectures, synthèse, éclairage, profil.

## 1. Décision produit

Le Sanctuaire ne doit pas être principalement une bibliothèque mystique ni un profil administratif.
Sa mission première, avant la première lecture, est de permettre au client de :

1. comprendre ce qui est demandé et pourquoi ;
2. choisir ce qu'il souhaite transmettre ;
3. conserver un brouillon ;
4. revenir sur chaque section ;
5. relire l'ensemble ;
6. sceller explicitement la base de sa lecture ;
7. savoir ensuite ce qui est verrouillé, en production ou livré.

Le modèle mental retenu est donc :

> **Je choisis → je relis → je scelle → Lumira prépare → je reçois.**

## 2. Diagnostic de l'interface précédente

### 2.1 Préparation trop courte et trop implicite

L'ancien parcours comportait trois étapes : naissance, photos, confirmation. Il ne donnait pas au client un espace clair pour sa question, son objectif, son contexte ou ses préférences, alors que ces champs existent déjà dans `UserProfile` et sont lus par l'IA.

Conséquences :

- perception d'un formulaire subi plutôt que d'une transmission choisie ;
- faible compréhension de l'usage des données ;
- absence de hiérarchie entre nécessaire et facultatif ;
- aucune vue complète des éléments transmis ;
- CTA final ambigu : « Valider et lancer la préparation » ;
- confusion entre profil permanent, brouillon et matière de la lecture.

### 2.2 Le profil mélange identité, diagnostic et matière transmise

La page Profil expose de nombreux champs comme une fiche complète, mais ne distingue pas :

- les informations générales du compte ;
- les préférences évolutives ;
- les éléments choisis pour une lecture donnée ;
- l'instantané déjà scellé.

Cette confusion réduit le sentiment de contrôle et crée un risque fonctionnel : une modification tardive pouvait être interprétée comme une modification de la lecture en cours.

### 2.3 Navigation orientée contenus, pas tâche principale

La navigation mettait en avant Accueil, Lectures, Synthèse et Éclairage. Le dossier envoyé à Lumira n'avait pas de destination dédiée, alors qu'il constitue le premier objet que le client doit comprendre et gérer.

### 2.4 États corrects mais formulation passive

Les statuts techniques étaient globalement cohérents, mais plusieurs formulations retiraient inutilement de l'agence au client :

- « Vous n'avez plus rien à faire » ;
- « Préparez votre première lecture » sans expliquer ce qui sera transmis ;
- absence de distinction visible entre brouillon, scellement et production.

### 2.5 Interfaces secondaires

#### Mes lectures

Points positifs : statuts compréhensibles, actions Lire/Écouter/Télécharger, erreurs explicites.

À améliorer ensuite :

- afficher une chronologie plus lisible ;
- rapprocher l'intention scellée de chaque lecture ;
- clarifier les différences entre vérification experte et fabrication des médias.

#### Ma synthèse

La page est propre mais très statique. Elle présente une grille d'informations sans hiérarchie narrative ni indication de provenance.

À améliorer ensuite :

- distinguer éléments issus de la lecture scellée et évolutions ultérieures ;
- afficher la date et la lecture source ;
- proposer une action contextuelle vers la lecture ou une demande d'éclairage.

#### Demander un éclairage

C'est l'interface la plus explicite : la page indique qu'une personne répond et non une automatisation.

À améliorer ensuite :

- alléger la densité du double panneau sur mobile ;
- afficher une seule action primaire selon l'état ;
- utiliser une progression conversationnelle plus lisible.

## 3. Principes UX appliqués

### Contrôle et consentement

- ne demander que le nécessaire ;
- marquer clairement chaque champ facultatif ;
- expliquer l'effet de l'envoi avant l'action finale ;
- ne pas confondre consentement légal et décision produit ;
- conserver une action finale explicite et non automatique.

### Divulgation progressive

- une intention par étape ;
- détails avancés regroupés dans le contexte facultatif ;
- navigation latérale sur desktop et progression compacte sur mobile ;
- récapitulatif avant soumission.

### Prévention et récupération des erreurs

- brouillon serveur ;
- statut visible de sauvegarde ;
- boutons Modifier dans le récapitulatif ;
- données saisies conservées lors du retour ;
- conflit serveur si la production a déjà commencé.

### Confiance

- aucune donnée n'est annoncée comme transmise avant scellement ;
- les photos sont identifiées comme privées ;
- l'instantané transmis est séparé du profil évolutif ;
- le client voit ce qui est renseigné, absent ou facultatif.

## 4. Architecture mise en place

### 4.1 Nouveau parcours en six étapes

1. **Votre choix** — explique le contrôle utilisateur ;
2. **Repères** — date et lieu requis, heure facultative ;
3. **Intention** — question et objectif facultatifs ;
4. **Photos** — visage et paume indépendamment facultatifs ;
5. **Contexte** — éléments intimes et style de lecture facultatifs ;
6. **Scellement** — récapitulatif complet, boutons Modifier, confirmation explicite.

Le CTA final devient :

> **Sceller et transmettre mon dossier**

### 4.2 Nouveau modèle serveur de scellement

Lors de la soumission finale :

- le profil est mis à jour ;
- le consentement versionné est enregistré ;
- l'onboarding passe à `COMPLETED` ;
- un instantané est enregistré dans `Order.clientInputs.readingIntake` ;
- l'instantané contient `sealedAt`, `sealedBy`, `consentVersion`, `contentHash` et le profil transmis ;
- l'opération est transactionnelle ;
- seule une commande `PAID` peut recevoir un premier scellement ;
- une seconde tentative ou un début de production provoque un conflit explicite.

### 4.3 Séparation profil / lecture

- le **profil** peut évoluer dans le temps ;
- le **dossier scellé** représente ce qui a été transmis pour une lecture précise ;
- pendant une lecture active, les modifications du profil utilisées comme source sont bloquées ;
- après livraison, les changements futurs ne doivent pas réécrire l'instantané historique.

### 4.4 Nouvelle destination « Mon dossier »

La navigation principale inclut désormais un espace permettant de voir :

- brouillon ou dossier scellé ;
- repères essentiels ;
- intention transmise ou non ;
- présence des photos ;
- nombre d'éléments de contexte facultatif ;
- état de production ;
- action de reprise avant scellement.

## 5. Fichiers concernés

- `apps/web/components/onboarding/ReadingPreparation.tsx`
- `apps/web/app/sanctuaire/dossier/page.tsx`
- `apps/web/lib/sanctuaireHomeState.ts`
- `apps/web/lib/sanctuaireNav.ts`
- `apps/web/components/sanctuary/MobileBottomNav.tsx`
- `apps/api/src/modules/users/reading-intake.service.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/reading-intake.service.spec.ts`
- `tests/e2e/sanctuaire-dashboard.spec.ts`

## 6. Critères d'acceptation

- [x] Le client comprend que rien n'est envoyé avant confirmation.
- [x] Les champs facultatifs sont identifiés.
- [x] Les réponses sont sauvegardées côté serveur.
- [x] Chaque section peut être revue et modifiée.
- [x] La soumission finale emploie un vocabulaire de scellement explicite.
- [x] Un instantané est conservé dans la commande.
- [x] Une soumission concurrente ou tardive est refusée.
- [x] Le dossier devient une destination permanente du Sanctuaire.
- [x] Le mobile conserve toutes les destinations essentielles.
- [ ] Les photos privées doivent encore être rendues visuellement via des endpoints sécurisés dédiés.
- [ ] La génération IA doit, dans une évolution suivante, lire prioritairement l'instantané `Order.clientInputs.readingIntake.profile`, avec fallback legacy vers `UserProfile`.
- [ ] Le profil doit afficher explicitement les champs modifiables hors production et les champs verrouillés pendant une lecture active.

## 7. Priorités restantes

### P0 avant ouverture commerciale

1. connecter le pipeline IA à l'instantané scellé et garder le fallback legacy ;
2. terminer l'affichage sécurisé des photos privées dans le Sanctuaire et le Desk ;
3. exécuter typecheck, tests API, build et Playwright sur la branche ;
4. effectuer une recette mobile réelle avec upload photo, reprise de brouillon et scellement.

### P1

1. refondre la page Profil autour de « compte », « préférences » et « confidentialité » ;
2. enrichir la synthèse avec provenance, date et lecture source ;
3. clarifier la timeline de production dans Mes lectures ;
4. simplifier l'expérience mobile des demandes d'éclairage.

## 8. Résultat attendu

Le Sanctuaire doit donner l'impression d'un espace personnel maîtrisé, non d'un formulaire opaque. Le client n'est pas seulement une source de données : il devient l'auteur de la matière transmise, avec une frontière claire entre brouillon, décision, production et lecture livrée.
