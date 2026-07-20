# Audit UX/UI du Sanctuaire — contrôle utilisateur et scellement du dossier

**Date :** 18 juillet 2026  
**Mise à jour technique :** 20 juillet 2026  
**Branche :** `codex/sanctuaire-user-agency-sealing`  
**Périmètre :** accueil, préparation initiale, dossier, navigation, photos privées, source IA, routage et diagnostics fournisseurs.

## Décision produit

Le Sanctuaire devient un espace de transmission maîtrisée. Le client choisit les éléments qu'il souhaite partager, conserve un brouillon, relit chaque section et scelle explicitement la matière de sa lecture.

> **Je choisis → je relis → je scelle → Lumira prépare → je reçois.**

## Architecture livrée

### Parcours client

1. Votre choix ;
2. Repères essentiels ;
3. Question et intention ;
4. Photos visage et paume ;
5. Contexte facultatif ;
6. Relecture et scellement.

Le CTA final est : **Sceller et transmettre mon dossier**.

### Scellement serveur

La soumission finale met à jour le profil, enregistre le consentement, clôt l'onboarding et crée transactionnellement un instantané dans :

```text
Order.clientInputs.readingIntake
```

L'instantané contient notamment `sealedAt`, `sealedBy`, `consentVersion`, `contentHash` et le profil transmis. Une seconde tentative ou un scellement après démarrage de la production est refusé.

### Source canonique de l'IA

Lorsqu'un instantané scellé valide existe, le pipeline utilise exclusivement :

```text
Order.clientInputs.readingIntake.profile
```

Le profil courant n'est pas fusionné silencieusement. Les anciennes commandes conservent un fallback explicite vers `UserProfile`, tracé comme `LEGACY_PROFILE`.

### Photos privées

Les références durables restent de la forme :

```text
s3://onboarding/{userId}/...
```

Le navigateur ne reçoit jamais cette référence comme source d'image. Les photos sont streamées par des routes protégées avec contrôle du propriétaire, bucket privé, cache privé et protection `nosniff`. Le Desk récupère les fichiers avec son token expert et crée des URL blob temporaires.

### Routage IA

Les appels texte, JSON, conversationnels, multimodaux et narration reçoivent un contexte commun comprenant l'agent, la mission, le niveau produit, le provider, le modèle et la version de prompt. Les changements de prompts ou de règles invalident le cache d'exécution.

### Diagnostics et observabilité

Le Desk utilise les variables serveur réelles :

```text
GEMINI_API_KEY
OPENAI_API_KEY
```

La migration `20260720000000_add_ai_runs` ajoute le registre `AiRun` pour tracer provider, modèle, mission, niveau produit, version de prompt, durée et statut sans stocker les contenus intimes ni les images.

## Critères atteints dans le code

- [x] Brouillon serveur et reprise ;
- [x] distinction requis/facultatif ;
- [x] récapitulatif modifiable ;
- [x] scellement explicite et transactionnel ;
- [x] instantané historique dans la commande ;
- [x] source IA scellée prioritaire ;
- [x] photos privées visibles via routes sécurisées ;
- [x] Matrice IA raccordée au multimodal et aux principaux agents ;
- [x] diagnostics Gemini/OpenAI cohérents ;
- [x] conflits avec les derniers workflows de `main` résolus ;
- [x] workflows Coolify durcis conservés.

## Limite de validation au moment de la fusion

Les runners GitHub hébergés ne sont pas disponibles en raison de l'état de facturation du compte. Aucun résultat CI n'est donc présenté comme réussi. La fusion repose sur une revue statique des contrats, des dépendances Nest, du schéma Prisma, de la migration, des contrôles de sécurité et de la synchronisation avec `main`.

L'exécution réelle des tests navigateur, de la recette staging et du parcours complet est reportée au prompt 7.

## Travaux différés

### Prompt 7 — Codex Terra High

- recette client → Desk → IA → validation → PDF/audio → livraison ;
- exécution réelle des tests Playwright et staging ;
- sécurité et responsive de bout en bout.

### Prompt 8 — Claude

- finition UX du profil, des lectures, de la synthèse et de l'éclairage ;
- accessibilité, rédaction, release et rollback.

## Déploiement

La migration `20260720000000_add_ai_runs` doit être appliquée au démarrage de l'API. Le worker de production doit rester actif sur une seule réplique. Les variables Gemini/OpenAI, AWS, Gotenberg et TTS restent obligatoires selon les fonctionnalités activées.
