# Audit UX/UI du Sanctuaire — contrôle utilisateur et scellement du dossier

**Date :** 18 juillet 2026  
**Mise à jour technique :** 20 juillet 2026  
**Branche :** `codex/sanctuaire-user-agency-sealing`  
**Périmètre :** accueil, préparation initiale, dossier, navigation, lectures, synthèse, éclairage, profil, photos privées et source IA.

## 1. Décision produit

Le Sanctuaire ne doit pas être principalement une bibliothèque mystique ni un profil administratif. Sa mission première, avant la première lecture, est de permettre au client de comprendre ce qui est demandé, choisir ce qu'il souhaite transmettre, conserver un brouillon, relire l'ensemble et sceller explicitement la base de sa lecture.

Le modèle mental retenu est :

> **Je choisis → je relis → je scelle → Lumira prépare → je reçois.**

## 2. Architecture livrée

### Parcours en six étapes

1. **Votre choix** — explique le contrôle utilisateur ;
2. **Repères** — date et lieu requis, heure facultative ;
3. **Intention** — question et objectif facultatifs ;
4. **Photos** — visage et paume indépendamment facultatifs ;
5. **Contexte** — éléments intimes et style de lecture facultatifs ;
6. **Scellement** — récapitulatif complet, boutons Modifier, confirmation explicite.

Le CTA final est :

> **Sceller et transmettre mon dossier**

### Modèle serveur de scellement

Lors de la soumission finale :

- le profil est mis à jour ;
- le consentement versionné est enregistré ;
- l'onboarding passe à `COMPLETED` ;
- un instantané est enregistré dans `Order.clientInputs.readingIntake` ;
- l'instantané contient `sealedAt`, `sealedBy`, `consentVersion`, `contentHash` et le profil transmis ;
- l'opération est transactionnelle ;
- seule une commande `PAID` peut recevoir un premier scellement ;
- une seconde tentative ou un début de production provoque un conflit explicite.

### Source canonique de génération

Le pipeline IA utilise désormais en priorité :

```text
Order.clientInputs.readingIntake.profile
```

Lorsqu'un instantané scellé valide existe, le profil courant n'est pas fusionné avec lui. Les anciennes commandes restent compatibles grâce à un fallback explicite vers `UserProfile`, identifié comme `LEGACY_PROFILE` dans les métadonnées de génération.

### Photos privées

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

### Routage IA et diagnostics

La matrice IA est raccordée aux appels texte, JSON, conversationnels et multimodaux. Le contexte d'exécution transmet l'agent, la mission, le niveau produit, le provider, le modèle et la version de prompt. Les changements de configuration invalident le cache d'exécution.

Le Desk expose des diagnostics cohérents avec les variables réellement utilisées :

```text
GEMINI_API_KEY
OPENAI_API_KEY
```

Les exécutions sont enregistrées dans `AiRun` sans stocker les données intimes, les prompts complets ni les images.

### Destination « Mon dossier »

La navigation principale inclut un espace permettant de voir :

- brouillon ou dossier scellé ;
- repères essentiels ;
- intention transmise ou non ;
- photos privées ;
- nombre d'éléments de contexte facultatif ;
- état de production ;
- action de reprise avant scellement.

## 3. Critères d'acceptation atteints dans le code

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

## 4. Validation et limites de cette fusion

Les runners GitHub hébergés ne sont pas disponibles au moment de la fusion en raison de l'état de facturation du compte. La décision de fusion repose donc sur :

- revue statique des contrats et dépendances ;
- cohérence du schéma Prisma et de la migration `AiRun` ;
- présence des suites unitaires et E2E ajoutées dans la branche ;
- résolution des divergences avec `main` ;
- conservation des workflows Coolify durcis présents sur `main`.

Aucun résultat de runner GitHub n'est présenté comme réussi. L'exécution réelle de la recette, des tests navigateur et de la validation staging est volontairement reportée au prompt 7.

## 5. Travaux différés

### Prompt 7 — Codex Terra High

- recette complète client → Desk → génération → validation → PDF/audio → livraison ;
- exécution réelle des scénarios Playwright et staging ;
- contrôle responsive et sécurité de bout en bout.

### Prompt 8 — Claude

- finition UX du profil, des lectures, de la synthèse et de l'éclairage ;
- accessibilité et rédaction finale ;
- préparation détaillée de release et de rollback.

## 6. Point de vigilance au déploiement

La migration suivante doit être appliquée avant ou au démarrage de l'API :

```text
20260720000000_add_ai_runs
```

Le déploiement doit conserver une seule réplique exécutant le worker de production et les variables serveur nécessaires aux providers, au stockage privé, à Gotenberg et au TTS.
