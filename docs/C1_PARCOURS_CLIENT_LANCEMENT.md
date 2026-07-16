# C1 — Parcours client de lancement

**Statut :** implémenté sur `launch/c1-core-onboarding`  
**Documents de référence :** A1 — architecture fondatrice ; B1 — onboarding mobile progressif  
**Périmètre :** Sanctuaire après achat, avant préparation experte de la lecture

## 1. Décision produit

Lumira ne demande plus au nouvel acheteur de terminer immédiatement le diagnostic holistique complet.

Le parcours est séparé en deux temps :

1. **Recueil essentiel** : date, lieu et heure facultative de naissance, photo du visage, photo de la paume.
2. **Approfondissement** : contexte personnel, intentions, état vibratoire, préférences et informations somatiques déjà prises en charge par le `HolisticWizard`.

Le client choisit explicitement :

- **Je complète maintenant** ;
- **Je termine plus tard**.

## 2. Objectif commercial

Réduire la friction juste après l'achat tout en conservant la profondeur de Lumira.

Le premier succès du parcours n'est plus « diagnostic complet ». Il devient :

> Les éléments essentiels de ma lecture ont été confiés à Lumira.

## 3. Architecture conservée

Cette évolution ne modifie pas :

- le modèle Prisma ;
- le pipeline de génération ;
- le Desk expert ;
- les statuts de commande ;
- le composant `HolisticWizard` ;
- l'endpoint `PATCH /users/profile` ;
- le composant `SmartPhotoUploader`.

Le nouveau flux orchestre uniquement les briques existantes dans un ordre plus adapté à la conversion mobile.

## 4. Parcours fonctionnel

### 4.1 Arrivée après paiement

Le paiement confirme la session et dirige le client vers le Sanctuaire avec l'onboarding demandé.

Si les éléments essentiels sont absents, le nouveau `CoreOnboardingWizard` s'ouvre.

Si les éléments essentiels existent déjà mais que le diagnostic approfondi n'est pas terminé, le `HolisticWizard` peut être proposé.

### 4.2 Étape 1 — Repères de naissance

Champs :

- date de naissance — obligatoire ;
- lieu de naissance — obligatoire ;
- heure de naissance — facultative.

Le nom, le prénom et l'email ne sont pas redemandés : ils sont déjà associés au compte et à l'achat.

### 4.3 Étape 2 — Visage et paume

Deux cartes distinctes :

- photo du visage ;
- photo de la paume.

Les deux images sont requises pour atteindre l'écran de choix. Le téléversement, la caméra, la compression, l'aperçu, le remplacement et la suppression réutilisent `SmartPhotoUploader`.

### 4.4 Étape 3 — Choix de poursuite

#### Compléter maintenant

- les éléments essentiels sont sauvegardés dans le profil ;
- le `HolisticWizard` s'ouvre avec la naissance et les photos préremplies ;
- le client ajoute son contexte sans saisir deux fois les mêmes informations.

#### Terminer plus tard

- les éléments essentiels sont sauvegardés ;
- le client revient dans le Sanctuaire ;
- un appel à l'action lui permet d'enrichir la lecture plus tard ;
- le brouillon local du parcours approfondi reste pris en charge.

## 5. État affiché dans le Sanctuaire

### Éléments essentiels incomplets

Le Sanctuaire demande :

> Transmettez vos repères de naissance, votre visage et votre paume.

### Éléments essentiels complets, approfondissement incomplet

Le Sanctuaire indique :

> Les bases sont enregistrées. Ajoutez votre contexte et vos questions quand vous le souhaitez.

La commande peut afficher le statut de préparation dès que les éléments essentiels sont reçus.

### Diagnostic approfondi complet

Le comportement existant est conservé : notifications expertes, Mandala et contenus dépendant de `profileCompleted` restent disponibles selon leurs règles actuelles.

## 6. Délai client

Le Sanctuaire affiche : **24 à 48 heures**.

Le message retenu est :

> Lumira prépare votre lecture avec attention. Vous pouvez encore ajouter du contexte tant que l'analyse n'a pas été finalisée.

La plateforme ne promet jamais une lecture instantanée.

## 7. Sauvegarde et reprise

- le nouveau parcours sauvegarde automatiquement un brouillon local lié à l'email du client ;
- la fermeture ne détruit pas la progression ;
- les éléments essentiels validés sont persistés par l'API existante ;
- le diagnostic approfondi conserve son mécanisme de brouillon actuel.

## 8. Gestion des erreurs

Une erreur de sauvegarde ne doit jamais fermer le parcours ni donner un faux message de succès.

Comportement :

- affichage d'une notification d'erreur ;
- maintien du formulaire et de son brouillon ;
- possibilité de réessayer ;
- aucune modification de `profileCompleted` tant que l'approfondissement n'est pas réellement transmis.

## 9. Critères de recette

### Recueil essentiel

- [ ] le parcours s'affiche après l'achat sur mobile ;
- [ ] la date et le lieu sont obligatoires ;
- [ ] l'heure est facultative ;
- [ ] le visage et la paume sont requis ;
- [ ] les photos peuvent être prises ou sélectionnées ;
- [ ] le retour arrière conserve les données ;
- [ ] la fermeture conserve le brouillon.

### Choix de poursuite

- [ ] « compléter maintenant » sauvegarde et ouvre le diagnostic approfondi ;
- [ ] les informations déjà saisies sont préremplies ;
- [ ] « terminer plus tard » sauvegarde et retourne au Sanctuaire ;
- [ ] le Sanctuaire distingue minimum reçu et approfondissement terminé.

### Statut de commande

- [ ] le message de préparation apparaît lorsque les éléments essentiels sont reçus ;
- [ ] le délai affiché est 24 à 48 heures ;
- [ ] aucun texte ne promet une génération instantanée ;
- [ ] le client peut encore ouvrir l'approfondissement.

### Non-régression

- [ ] le login par magic link fonctionne ;
- [ ] l'auto-login post-checkout fonctionne ;
- [ ] le `HolisticWizard` peut toujours être terminé ;
- [ ] le Desk et le pipeline IA ne sont pas modifiés ;
- [ ] les profils déjà complets ne revoient pas l'onboarding.

## 10. Limites volontaires du lot C1

Non inclus :

- email automatique de reprise ;
- nouveau statut Prisma pour le recueil essentiel ;
- déclenchement automatique de la génération ;
- modification des prompts ou des modèles ;
- évolution du Desk ;
- refonte du Mandala.

Ces sujets doivent être traités dans des lots séparés afin de préserver la stabilité du lancement.

## 11. Fichiers concernés

- `apps/web/components/onboarding/CoreOnboardingWizard.tsx` — nouveau recueil essentiel ;
- `apps/web/app/sanctuaire/page.tsx` — orchestration du recueil, de l'approfondissement et du statut client.

## 12. Condition de mise en production

Le lot peut être fusionné lorsque :

1. la CI est verte ;
2. le parcours est testé sur un téléphone réel ;
3. une commande de test complète le flux post-checkout ;
4. les deux choix de poursuite sont testés ;
5. la sauvegarde et la reprise sont confirmées ;
6. aucune régression n'est constatée dans le Desk ou le pipeline.
