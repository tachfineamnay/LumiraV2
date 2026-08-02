# Oracle Lumira — checklist de mise en production manuelle

Cette procédure est conçue pour un déploiement direct depuis `main` vers Coolify, sans GitHub Actions.

## 1. Conditions de départ

Avant toute opération :

- aucun client ne doit être supprimé ou purgé ;
- ne lancer aucun reset ou seed de base de données ;
- conserver les commandes, versions de lectures, PDF, audios et fichiers privés existants ;
- ne pas modifier le prix de 17 € ni le produit Stripe ;
- ne pas basculer les clés Stripe de production en mode test ;
- garder tous les flags Vertex Memory désactivés pendant cette livraison :
  - `VERTEX_MEMORY_ENABLED=false`
  - `VERTEX_MEMORY_READ_ENABLED=false`
  - `VERTEX_MEMORY_WRITE_ENABLED=false`
  - `VERTEX_MEMORY_AUTO_APPROVE=false`
  - `MEMORY_WORKER_ENABLED=false`

## 2. Sauvegarde obligatoire

Dans l’interface d’hébergement ou directement sur PostgreSQL :

1. créer une sauvegarde complète de la base ;
2. vérifier que le fichier de sauvegarde existe et possède une taille non nulle ;
3. conserver la sauvegarde hors du conteneur applicatif ;
4. noter le SHA Git actuellement déployé ;
5. ne lancer aucune migration destructive.

Les migrations éventuellement présentes dans le repository doivent être examinées avant exécution. Une migration additive peut être appliquée selon le processus habituel ; une suppression ou un renommage de colonne impose un arrêt du déploiement.

## 3. Certification locale avant déploiement

Depuis la racine du repository :

```bash
pnpm verify:release:local
```

Cette commande exécute successivement :

1. contrôle Git et `git diff --check` ;
2. `pnpm install --frozen-lockfile` ;
3. génération Prisma ;
4. typecheck du monorepo ;
5. lint du monorepo ;
6. tests API ;
7. build production du web ;
8. installation de Chromium et WebKit Playwright ;
9. suite Playwright complète.

Pour réexécuter sans réinstaller les dépendances :

```bash
VERIFY_SKIP_INSTALL=1 pnpm verify:release:local
```

Pour réexécuter sans retélécharger les navigateurs Playwright :

```bash
VERIFY_SKIP_INSTALL=1 VERIFY_SKIP_BROWSER_INSTALL=1 pnpm verify:release:local
```

Commandes ciblées utiles :

```bash
pnpm test:e2e:responsive
pnpm test:e2e:checkout
pnpm test:e2e:readings
```

### Condition de passage

Ne déployer que si la commande termine par :

```text
VALIDATION LOCALE VERTE
```

Un test ignoré doit être compris. Un test rouge ne doit jamais être supprimé, ralenti artificiellement ou remplacé par une assertion plus faible uniquement pour permettre le déploiement.

## 4. Variables Coolify à contrôler

### Conteneur web

- `NEXT_PUBLIC_API_URL=https://api.oraclelumira.com`
- `API_INTERNAL_URL` pointe vers le service API interne correct ;
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` commence par `pk_live_` en production ;
- `NEXT_PUBLIC_APP_URL=https://oraclelumira.com` si la variable est utilisée ;
- les identifiants analytics restent optionnels et conformes au consentement ;
- aucune clé secrète Stripe ne doit être placée dans une variable `NEXT_PUBLIC_*`.

### Conteneur API

- clé Stripe secrète live correcte ;
- secret webhook live correct ;
- URL web publique correcte ;
- accès PostgreSQL, S3, email et Gotenberg inchangés ;
- flags Vertex Memory maintenus à `false` pour cette livraison.

## 5. Déploiement Coolify

1. vérifier que `main` pointe sur le SHA à certifier ;
2. déclencher le redéploiement web et API selon la procédure Coolify habituelle ;
3. ne pas vider la base de données ;
4. ne pas recréer les volumes ;
5. suivre les logs de build ;
6. vérifier l’absence d’erreur Prisma, Stripe, S3 ou démarrage NestJS ;
7. attendre que les health checks soient verts ;
8. noter le SHA effectivement déployé et l’heure du déploiement.

## 6. Smoke test public après déploiement

Tester en navigation privée :

- `https://oraclelumira.com/`
- `https://oraclelumira.com/commande`
- `https://oraclelumira.com/payment-success`
- `https://oraclelumira.com/sanctuaire/login`
- `https://oraclelumira.com/robots.txt`
- `https://oraclelumira.com/sitemap.xml`

Vérifier :

- aucune page blanche ;
- aucune erreur 500 ;
- aucun asset principal en 404 ;
- contenu officiel de la home inchangé ;
- offre affichée à 17 € avec paiement unique et accès de trois mois ;
- menu mobile opaque, scrollable et fermé par Échap ;
- ancre vers l’offre fonctionnelle ;
- formulaire checkout visible ;
- login Sanctuaire visible ;
- absence d’overflow horizontal.

## 7. Test checkout

### Local ou environnement Stripe test

Effectuer les scénarios Stripe de test uniquement dans un environnement où l’API et la clé publiable sont toutes les deux en mode test :

- paiement réussi ;
- carte refusée ;
- authentification 3D Secure ;
- retour après authentification ;
- rechargement pendant la préparation ;
- rechargement pendant la finalisation ;
- double clic rapide sur « Payer 17 € » ;
- coupure réseau simulée ;
- reprise de la même tentative sans nouvelle intention.

Attendu après une finalisation incertaine : le client voit clairement qu’il ne doit pas payer une seconde fois.

### Production live

Ne jamais mettre une clé `pk_test_` dans le front de production et ne jamais utiliser une carte de test contre l’API live.

Un achat live de contrôle ne doit être réalisé que volontairement par le propriétaire, avec une adresse de test identifiable, puis vérifié dans Stripe, la base, les emails et le Sanctuaire. Il n’est pas exécuté automatiquement par cette procédure.

## 8. Checklist iPhone Safari

Sur un iPhone réel :

### Site public

- ouvrir et fermer le menu ;
- tester l’ancre vers l’offre après avoir scrollé ;
- vérifier les safe areas ;
- passer portrait ↔ paysage ;
- vérifier qu’aucun texte ou CTA essentiel n’est masqué.

### Checkout

- ouvrir le clavier sur chaque champ ;
- vérifier que le bouton reste atteignable ;
- tester le préremplissage d’un compte connecté ;
- modifier un champ avant l’arrivée du profil et vérifier qu’il n’est pas écrasé ;
- contrôler la zone Stripe dans Safari ;
- tester le retour 3D Secure uniquement en environnement test cohérent.

### Onboarding

- saisir les quatre étapes ;
- fermer puis reprendre le brouillon ;
- choisir une photo dans la galerie ;
- prendre une photo avec la caméra ;
- refuser puis réautoriser la caméra ;
- vérifier la rotation de photos prises en portrait ;
- remplacer et supprimer une photo ;
- transmettre une seule fois.

### Sanctuaire

- vérifier la navigation basse ;
- ouvrir le menu profil et tester Échap/Tab avec un clavier externe si disponible ;
- ouvrir une lecture PDF ;
- zoomer, paginer, télécharger et ouvrir dans le lecteur natif ;
- lire, mettre en pause et déplacer la progression audio ;
- ouvrir la messagerie avec le clavier ;
- vérifier que le textarea et le bouton d’envoi restent visibles.

## 9. Checklist Android Chrome

Sur un appareil Android réel :

- répéter le parcours public et checkout ;
- ouvrir Gboard dans les champs longs ;
- vérifier l’absence de saut de viewport ;
- tester la galerie et la caméra arrière ;
- passer portrait ↔ paysage ;
- tester PDF, téléchargement et ouverture externe ;
- tester lecture, pause, seek et reprise audio ;
- tester la messagerie avec Gboard ouvert ;
- vérifier que le bouton d’envoi n’est pas recouvert.

## 10. Checklist tablette

En portrait et paysage :

- landing, offre et checkout ;
- passage entre navigation mobile et sidebar ;
- menu profil ;
- onboarding complet ;
- liste des lectures ;
- lecteur PDF et contrôles ;
- audio ;
- synthèse ;
- messagerie ;
- profil et préférences.

Tester particulièrement les largeurs 768 px, 800 px et 1024 px.

## 11. Contrôles de données après test

Pour le compte de contrôle :

- une seule commande pour une seule tentative de paiement ;
- aucun doublon de PaymentIntent ou d’accès ;
- brouillon onboarding restaurable avant transmission ;
- dossier scellé non modifiable après transmission ;
- références de photos privées, jamais d’URL publique persistée ;
- lecture PDF et audio toujours rattachés au bon client ;
- messages rattachés au bon dossier ;
- aucune suppression ou modification d’une ancienne lecture.

## 12. Décision finale

### GO PUBLIC

Seulement si :

- `pnpm verify:release:local` est vert ;
- les routes publiques répondent ;
- le checkout n’est pas bloqué ;
- aucun double paiement n’est observé ;
- connexion, onboarding et Sanctuaire fonctionnent ;
- PDF et audio sont accessibles ;
- les tests iPhone, Android et tablette ne révèlent aucun blocage ;
- les données historiques restent intactes.

### GO SOUS RÉSERVE

Uniquement pour un défaut non bloquant, documenté, sans impact sur l’achat, les données ou l’accès aux lectures.

### NO-GO

Dès qu’un défaut peut empêcher l’achat, créer un doublon, bloquer la connexion, perdre un brouillon, empêcher l’envoi des photos, masquer une erreur ou rendre une lecture inaccessible.

## 13. Fiche de résultat

```text
SHA déployé :
Date et heure :
Sauvegarde PostgreSQL vérifiée : OUI / NON
Validation locale verte : OUI / NON
iPhone Safari : OK / BLOQUÉ
Android Chrome : OK / BLOQUÉ
Tablette portrait : OK / BLOQUÉ
Tablette paysage : OK / BLOQUÉ
Checkout local/test : OK / BLOQUÉ
Achat live contrôlé effectué : OUI / NON
Commandes et lecture de contrôle intactes : OUI / NON
Problèmes restants :
VERDICT : GO PUBLIC / GO SOUS RÉSERVE / NO-GO
```
