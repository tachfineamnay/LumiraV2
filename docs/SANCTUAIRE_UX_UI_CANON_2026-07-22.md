# Sanctuaire Lumira — Canon UX/UI V1

**Date de référence :** 22 juillet 2026  
**Périmètre :** `apps/web/app/sanctuaire`, navigation, onboarding, lecture, synthèse, demandes d’éclairage et profil.  
**Statut :** source produit et design canonique pour la V1.

## 1. Intention produit

Le Sanctuaire n’est pas un tableau de bord SaaS, une boutique, un jeu spirituel ou une démonstration d’intelligence artificielle.

C’est un espace privé, calme et lisible où une personne peut :

1. choisir les informations qu’elle souhaite transmettre ;
2. relire et sceller son dossier ;
3. comprendre où en est la préparation de sa lecture ;
4. écouter ou lire la lecture validée ;
5. retrouver les repères essentiels dans une synthèse ;
6. demander un éclairage humain lié à son dossier.

La promesse UX est :

> Je choisis → je relis → je scelle → Lumira prépare → l’équipe valide → je reçois.

## 2. Principes non négociables

### 2.1 Une action principale par écran

Chaque écran doit rendre évidente l’action suivante. Les actions secondaires restent visibles sans concurrencer l’action principale.

### 2.2 L’IA reste invisible

Le client ne choisit pas de modèle, de provider, d’agent ou de réglage technique. Il ne doit pas avoir l’impression de recevoir un texte automatique brut.

Le produit présente clairement la chaîne de valeur :

- matière choisie par le client ;
- préparation assistée par IA ;
- relecture et validation humaine ;
- livraison PDF et audio ;
- possibilité de demander un éclairage à l’équipe.

### 2.3 Aucun jargon interne

Ne jamais exposer : `PAID`, `PROCESSING`, `AWAITING_VALIDATION`, `COMPLETED`, `provider`, `agent`, `prompt`, `job`, `queue`, `RAG` ou des noms de modèles.

Employer :

- Dossier à préparer ;
- Brouillon sauvegardé ;
- Dossier transmis ;
- Lecture en préparation ;
- Relecture humaine ;
- Lecture prête ;
- Audio en préparation.

### 2.4 Mobile d’abord

Le Sanctuaire doit être utilisable d’une seule main, sans navigation cachée et sans devoir comprendre l’architecture du produit.

Cibles minimales :

- zones tactiles de 44 px ;
- textes de formulaire à 16 px minimum sur mobile ;
- quatre destinations maximum dans la barre inférieure ;
- aucune information essentielle uniquement au survol ;
- respect des safe areas iOS/Android.

### 2.5 La confiance avant l’effet visuel

Le design doit exprimer l’intimité, la profondeur et la qualité, sans surcharge ésotérique.

À conserver :

- bleu abyssal ;
- lumière horizon dorée ;
- typographie Playfair pour les titres ;
- typographie Inter pour l’interface ;
- surfaces discrètes, contrastées et aérées ;
- étoiles très subtiles.

À éviter :

- mandala interactif ;
- rotations, pulsations et animations décoratives continues ;
- cartes partout ;
- badges de niveau ;
- gamification ;
- faux chat d’oracle automatique ;
- empilement de dégradés brillants ;
- vocabulaire grandiloquent qui masque l’action.

## 3. Architecture de navigation

### 3.1 Navigation mobile principale

Quatre destinations permanentes :

1. **Accueil** — situation actuelle et prochaine action ;
2. **Lectures** — audio, PDF et historique ;
3. **Synthèse** — repères essentiels ;
4. **Éclairage** — demandes et échanges avec l’équipe.

Le dossier n’occupe pas un cinquième onglet mobile. Il reste accessible :

- depuis l’accueil tant qu’il doit être préparé ou consulté ;
- depuis le menu profil ;
- depuis les états vides de Lectures ;
- depuis une URL directe protégée.

### 3.2 Navigation desktop

La barre latérale peut conserver :

- Accueil ;
- Mon dossier ;
- Mes lectures ;
- Ma synthèse ;
- Demander un éclairage ;
- Mon profil.

Le menu avatar contient :

- Mon dossier ;
- Mon profil ;
- Réglages ;
- Déconnexion.

Aucun achat, upgrade, niveau ou catalogue ne doit apparaître dans le Sanctuaire V1.

## 4. Parcours de référence

### État A — Dossier à préparer

L’accueil affiche :

- une salutation sobre ;
- la raison de la collecte ;
- le contrôle laissé au client ;
- le brouillon sauvegardé ;
- le formulaire directement dans la page ;
- le CTA final « Sceller et transmettre mon dossier ».

Le formulaire reste en cinq étapes internes :

1. repères essentiels ;
2. intention ;
3. contexte facultatif ;
4. photos privées ;
5. relecture et scellement.

Les photos visage et paume sont facultatives. L’interface doit expliquer leur utilité sans pression.

### État B — Lecture en préparation

L’accueil devient un écran de réassurance :

- dossier reçu ;
- délai habituel de 24 à 48 heures ;
- aucune action supplémentaire nécessaire ;
- possibilité de revoir ce qui a été transmis ;
- notification par e-mail dès disponibilité.

Une progression simple peut montrer :

1. Dossier transmis ;
2. Lecture préparée ;
3. Validation humaine ;
4. Livraison.

Cette progression ne doit pas simuler une précision technique inexistante.

### État C — Lecture prête

L’ordre de priorité est :

1. lecteur audio ;
2. bouton « Lire ma lecture » ;
3. téléchargement PDF ;
4. accès à la synthèse ;
5. demande d’éclairage humain.

Le Sanctuaire doit rappeler que la synthèse est un raccourci et que le PDF/audio constituent la lecture complète.

## 5. Règles par écran

### Accueil

L’accueil répond en moins de cinq secondes à trois questions :

- Où en est ma lecture ?
- Que dois-je faire maintenant ?
- Où retrouver mon contenu ?

Il ne doit pas dupliquer tout le contenu des autres pages.

### Mon dossier

Avant scellement : contenu éditable, autosauvegardé et relisible.  
Après scellement : vue en lecture seule de l’instantané transmis.  
Aucune modification silencieuse après démarrage de la production.

### Mes lectures

Chaque lecture présente :

- titre ;
- statut humain ;
- date ;
- intention, si utile ;
- audio, PDF et lecture plein écran lorsqu’ils sont disponibles.

Éviter les identifiants techniques et les numéros de commande comme information principale.

### Ma synthèse

La synthèse doit rester concise, hiérarchisée et non déterministe :

- archétype comme dynamique, jamais comme étiquette absolue ;
- état actuel ;
- direction ;
- point de vigilance ;
- conseils essentiels ;
- mots d’ancrage.

### Demander un éclairage

La page est une messagerie de suivi humain, pas un chatbot IA.

Elle doit indiquer :

- que la demande est liée au dossier ;
- qu’une personne de l’équipe la lit ;
- le statut de la demande ;
- la lecture concernée, si applicable ;
- l’historique des échanges.

Préférer « Nouvelle demande » à « Nouveau chat ».

### Profil et réglages

Le profil contient les données personnelles courantes. Le dossier scellé reste distinct et historique.

Les réglages concernent seulement :

- préférences de communication ;
- confidentialité ;
- sécurité ;
- accessibilité utile.

## 6. Ton rédactionnel

Le ton est calme, direct, humain et précis.

Préférer :

- « Votre dossier a bien été reçu. »
- « Vous n’avez plus rien à faire. »
- « Le délai habituel est de 24 à 48 heures. »
- « Votre lecture est relue par l’équipe avant sa mise à disposition. »
- « Décrivez un seul sujet clairement. »

Éviter :

- les promesses de vérité absolue ;
- le diagnostic médical ou psychologique ;
- les formulations anxiogènes ;
- les injonctions spirituelles ;
- les termes techniques ;
- les textes trop longs dans les cartes de statut.

## 7. États et résilience

Chaque page doit traiter explicitement :

- chargement ;
- absence de contenu ;
- erreur réseau ;
- contenu encore en préparation ;
- fichier momentanément indisponible ;
- session expirée ;
- brouillon en conflit ;
- action en cours ;
- action réussie.

Les textes saisis dans une demande ou un dossier ne doivent pas être perdus après une erreur récupérable.

## 8. Accessibilité

- Contraste WCAG AA sur les textes et contrôles essentiels.
- Focus visible sur tous les éléments interactifs.
- Labels explicites pour les champs.
- `aria-live` ou `role=status` pour les changements asynchrones importants.
- `role=alert` pour les erreurs bloquantes.
- Respect de `prefers-reduced-motion`.
- Le sens ne dépend jamais uniquement de la couleur.
- Le PDF dispose d’une lecture plein écran et d’un téléchargement séparé.

## 9. Accès early V1

L’offre de lancement donne un accès de trois mois. Cette information peut apparaître dans le menu profil et les informations de compte, sans devenir un élément commercial permanent dans l’en-tête principal.

Le Sanctuaire ne doit pas afficher de logique de renouvellement, d’upgrade ou de catalogue tant que ces parcours ne sont pas réellement définis et opérationnels.

## 10. Critères d’acceptation UX/UI

- La barre mobile contient quatre destinations maximum.
- Le dossier reste accessible sans occuper un onglet mobile permanent.
- L’accueil affiche une seule prochaine action dominante.
- Le délai de 24 à 48 heures est visible pendant la préparation.
- La validation humaine est mentionnée sans dénigrer l’assistance IA.
- L’audio est prioritaire lorsque la lecture est prête.
- Aucun mandala, niveau, chemin de sept jours, rêve ou chatbot IA n’est remis dans la navigation V1.
- Tous les écrans critiques possèdent chargement, vide et erreur.
- Les textes restent compréhensibles sans connaître Lumira.
- Le parcours est utilisable à 320 px de large.

## 11. Fichiers de référence

- `apps/web/app/sanctuaire/page.tsx`
- `apps/web/app/sanctuaire/SanctuaireLayoutClient.tsx`
- `apps/web/lib/sanctuaireNav.ts`
- `apps/web/lib/sanctuaireHomeState.ts`
- `apps/web/components/sanctuary/MobileBottomNav.tsx`
- `apps/web/components/sanctuary/SanctuaireSidebar.tsx`
- `apps/web/components/onboarding/ReadingPreparation.tsx`
- `apps/web/app/sanctuaire/dossier/page.tsx`
- `apps/web/app/sanctuaire/draws/page.tsx`
- `apps/web/app/sanctuaire/synthesis/page.tsx`
- `apps/web/app/sanctuaire/chat/page.tsx`

Toute évolution future du Sanctuaire doit être comparée à ce document avant fusion.