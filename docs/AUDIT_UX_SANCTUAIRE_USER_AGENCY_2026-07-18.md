# Audit UX/UI du Sanctuaire — contrôle utilisateur et scellement du dossier

**Date :** 18 juillet 2026  
**Mise à jour technique :** 20 juillet 2026  
**Branche :** `codex/sanctuaire-user-agency-sealing`  
**Périmètre :** accueil, préparation initiale, dossier, navigation, lectures, synthèse, éclairage, profil, photos privées et source IA.

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

Le modèle mental retenu est :

> **Je choisis → je relis → je scelle → Lumira prépare → je reçois.**

## 2. Diagnostic de l'interface précédente

### 2.1 Préparation trop courte et trop implicite

L'ancien parcours comportait trois étapes : naissance, photos, confirmation. Il ne donnait pas au client un espace clair pour sa question, son objectif, son contexte ou ses préférences, alors que ces champs existent dans `UserProfile` et sont exploités par l'IA.

Conséquences :

- perception d'un formulaire subi plutôt que d'une transmission choisie ;
- faible compréhension de l'usage des données ;
- absence de hiérarchie entre nécessaire et facultatif ;
- aucune vue complète des éléments transmis ;
- CTA final ambigu : « Valider et lancer la préparation » ;
- confusion entre profil permanent, brouillon et matière de la lecture.

### 2.2 Le profil mélangeait identité, diagnostic et matière transmise

La page Profil exposait de nombreux champs sans distinguer :

- les informations générales du compte ;
- les préférences évolutives ;
- les éléments choisis pour une lecture donnée ;
- l'instantané déjà scellé.

Cette confusion réduisait le sentiment de contrôle et créait un risque fonctionnel : une modification tardive pouvait être interprétée comme une modification de la lecture en cours.

### 2.3 Navigation orientée contenus, pas tâche principale

La navigation mettait en avant Accueil, Lectures, Synthèse et Éclairage. Le dossier envoyé à Lumira n'avait pas de destination dédiée, alors qu'il constitue le premier objet que le client doit comprendre et gérer.

### 2.4 États corrects mais formulation passive

Plusieurs formulations retiraient inutilement de l'agence au client :

- « Vous n'avez plus rien à faire » ;
- « Préparez votre première lecture » sans expliquer ce qui sera transmis ;
- absence de distinction visible entre brouillon, scellement et production.

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

- aucune donnée annoncée comme transmise avant scellement ;
- photos identifiées et servies comme ressources privées ;
- instantané transmis séparé du profil évolutif ;
- client informé de ce qui est renseigné, absent ou facultatif.

## 4. Architecture livrée

### 4.1 Parcours en six étapes

1. **Votre choix** — explique le contrôle utilisateur ;
2. **Repères** — date et lieu requis, heure facultative ;
3. **Intention** — question et objectif facultatifs ;
4. **Photos** — visage et paume indépendamment facultatifs ;
5. **Contexte** — éléments intimes et style de lecture facultatifs ;
6. **Scellement** — récapitulatif complet, boutons Modifier, confirmation explicite.

Le CTA final est :

> **Sceller et transmettre mon dossier**

### 4.2 Modèle serveur de scellement

Lors de la soumission finale :

- le profil est mis à jour ;
- le consentement versionné est enregistré ;
- l'onboarding passe à `COMPLETED` ;
- un instantané est enregistré dans `Order.clientInputs.readingIntake` ;
- l'instantané contient `sealedAt`, `sealedBy`, `consentVersion`, `contentHash` et le profil transmis ;
- l'opération est transactionnelle ;
- seule une commande `PAID` peut recevoir un premier scellement ;
- une seconde tentative ou un début de production provoque un conflit explicite.

### 4.3 Source canonique de génération

Le pipeline IA utilise désormais en priorité :

```text
Order.clientInputs.readingIntake.profile
```

Lorsqu'un instantané scellé valide existe, le profil courant n'est pas fusionné avec lui. Les anciennes commandes restent compatibles grâce à un fallback explicite vers `UserProfile`, identifié comme `LEGACY_PROFILE` dans les métadonnées de génération.

### 4.4 Photos privées

Les photos restent stockées dans le bucket privé `uploads` avec des références :

```text
s3://onboarding/{userId}/...
```

Elles sont consultées par des routes serveur protégées :

- client authentifié : ses propres photos uniquement ;
- expert ou administrateur : photos du client demandé ;
- validation stricte du préfixe et du propriétaire ;
- streaming HTTP privé ;
- aucune balise d'image alimentée par une référence `s3://` ;
- aucune URL présignée persistée en base.

### 4.5 Routage IA et diagnostics

La matrice IA est raccordée aux appels texte, JSON, conversationnels et multimodaux. Le contexte d'exécution transmet l'agent, la mission, le niveau produit, le provider, le modèle et la version de prompt. Les changements de configuration invalident le cache d'exécution.

Le Desk expose des diagnostics cohérents avec les variables réellement utilisées :

```text
GEMINI_API_KEY
OPENAI_API_KEY
```

Les exécutions sont enregistrées dans `AiRun` sans stocker les données intimes, les prompts complets ni les images.

### 4.6 Destination « Mon dossier »

La navigation principale inclut un espace permettant de voir :

- brouillon ou dossier scellé ;
- repères essentiels ;
- intention transmise ou non ;
- photos privées ;
- nombre d'éléments de contexte facultatif ;
- état de production ;
- action de reprise avant scellement.

## 5. Critères d'acceptation atteints

- [x] Le client comprend que rien n'est envoyé avant confirmation.
- [x] Les champs facultatifs sont identifiés.
- [x] Les réponses sont sauvegardées côté serveur.
- [x] Chaque section peut être revue et modifiée.
- [x] La soumission finale emploie un vocabulaire de scellement explicite.
- [x] Un instantané est conservé dans la commande.
- [x] Une soumission concurrente ou tardive est refusée.
- [x] Le dossier devient une destination permanente du Sanctuaire.
- [x] Le mobile conserve les destinations essentielles.
- [x] Les photos privées disposent de routes sécurisées dans le Sanctuaire et le Desk.
- [x] La génération IA lit prioritairement l'instantané scellé avec fallback legacy.
- [x] La matrice IA est appliquée aux principaux agents et au multimodal.
- [x] Les diagnostics Gemini/OpenAI reflètent les variables serveur réelles.

## 6. Validation et limites de cette fusion

Les runners GitHub hébergés ne sont pas disponibles au moment de la fusion en raison de l'état de facturation du compte. La décision de fusion repose donc sur :

- revue statique des contrats et dépendances ;
- cohérence du schéma Prisma et de la migration `AiRun` ;
- présence des suites unitaires et E2E ajoutées dans la branche ;
- résolution des divergences avec `main` ;
- conservation des workflows Coolify durcis présents sur `main`.

Aucun résultat de runner GitHub n'est présenté comme réussi.

## 7. Travaux différés

### Prompt 7 — Codex Terra High

- recette complète client → Desk → génération → validation → PDF/audio → livraison ;
- exécution réelle des scénarios Playwright et staging ;
- contrôle responsive et sécurité de bout en bout.

### Prompt 8 — Claude

- finition UX du profil, des lectures, de la synthèse et de l'éclairage ;
- accessibilité et rédaction finale ;
- préparation détaillée de release et de rollback.

## 8. Point de vigilance au déploiement

La migration suivante doit être appliquée avant ou au démarrage de l'API :

```text
20260720000000_add_ai_runs
```

Le déploiement doit conserver une seule réplique exécutant le worker de production et les variables serveur nécessaires aux providers, au stockage privé, à Gotenberg et au TTS.
