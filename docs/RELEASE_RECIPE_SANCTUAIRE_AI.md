# Recette de release — Sanctuaire → IA → livraison

Cette recette vérifie le parcours réel d’une commande payée jusqu’à la lecture livrée. Elle ne doit être exécutée que sur un environnement de staging isolé avec des données de test dédiées.

## Exécution de cette version

| Élément                     | Valeur                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| URL testée                  | Non exécutée localement : renseigner l’URL staging HTTPS réellement utilisée.                        |
| Compte client               | Créer `e2e.sanctuaire+<horodatage>@example.test` ; ne jamais utiliser un compte réel.                |
| Compte expert               | Compte EXPERT staging dédié, non administrateur si possible.                                         |
| Commande                    | Commander le produit de test avec Stripe test mode ; noter `orderNumber` et `paymentIntent`.         |
| Fichier visage              | JPEG de test non biométrique, ≤ 1,2 Mo.                                                              |
| Fichier paume               | JPEG de test non biométrique, ≤ 1,2 Mo.                                                              |
| Résultat de cette exécution | Non exécuté : aucun accès staging, Stripe test, S3, base ou SMTP n’est disponible dans ce workspace. |

Avant de commencer, relever le SHA (`git rev-parse HEAD`), l’URL, l’heure, le `orderNumber`, l’ID du client et l’ID du job dans le ticket de release sécurisé. Ne jamais les copier dans les logs publics ou dans ce dépôt.

## Parcours client

- [ ] Payer une commande Stripe de test ; le webhook crée ou retrouve une unique commande `PAID`.
- [ ] Vérifier la création/récupération de session Sanctuaire après preuve serveur du paiement.
- [ ] Ouvrir l’accueil puis **Mon dossier** ; aucun accès ne dépend d’un abonnement récurrent.
- [ ] Saisir date et lieu de naissance ; vérifier que l’heure reste facultative.
- [ ] Ajouter une intention, puis visage, paume et contexte facultatifs.
- [ ] Fermer complètement le navigateur, ouvrir un nouveau navigateur et vérifier la reprise du brouillon serveur.
- [ ] Modifier une section depuis le récapitulatif ; vérifier que la modification est visible avant scellement.
- [ ] Cocher la confirmation et sceller le dossier.
- [ ] Vérifier que le second scellement retourne `409 Conflict` et que l’interface n’offre plus de modification.
- [ ] Vérifier le dossier scellé : photos visibles via des routes authentifiées, sans `s3://` ni URL présignée dans le DOM.
- [ ] Attendre `PROCESSING`, puis vérifier qu’une tentative de modifier le dossier est refusée.

## Parcours Desk et production

- [ ] Se connecter avec le compte EXPERT ; une requête non authentifiée vers `/admin` doit finir sur `/admin/login`.
- [ ] Retrouver la commande et le client ; ouvrir le Studio.
- [ ] Vérifier les deux photos via les flux privés, sans lien S3 affiché ou copiable.
- [ ] Vérifier `Source de lecture : SEALED_INTAKE` et que les valeurs visibles correspondent à l’instantané scellé, non au profil modifié après scellement.
- [ ] Lancer la production. Statuts attendus : `QUEUED` puis `RUNNING`, avec `GENERATING_READING` comme étape active.
- [ ] Quitter le Studio, ouvrir le Centre de production puis revenir : le même job doit toujours être actif et ne doit pas être relancé.
- [ ] Attendre la lecture générée : commande `AWAITING_VALIDATION`, job `SUCCEEDED`.
- [ ] Éditer le contenu en expert, puis sceller la version expert. Vérifier une `ReadingVersion` `SEALED` et que son hash est stable.
- [ ] Vérifier la génération du PDF depuis cette `ReadingVersion`, puis le lancement et la disponibilité de l’audio.
- [ ] Vérifier l’envoi de notification client une seule fois et l’accès à la lecture, au PDF et à l’audio dans le Sanctuaire.

## Vérifications techniques attendues

### Logs

Rechercher par `orderNumber`, `jobId` et IDs non sensibles. Les événements attendus sont :

- paiement/webhook traité une fois ;
- dossier client scellé ;
- `Reading source: SEALED_INTAKE` ;
- job lecture `QUEUED` → `RUNNING` → `SUCCEEDED` ;
- `ReadingVersion` scellée ;
- PDF créé pour le hash de la version scellée ;
- audio créé pour le même hash ;
- livraison e-mail tentée puis `SENT`.

Les logs ne doivent contenir ni token de session, lien magique brut, secret provider, URL présignée complète, e-mail de production, ni contenu photo.

### S3 / stockage privé

- [ ] Confirmer les clés sous le préfixe `onboarding/<userId>/` et l’absence d’objet public.
- [ ] Confirmer que les photos sont lues par flux authentifié ou URL courte non persistée.
- [ ] Confirmer que le PDF est stocké sous le préfixe de lecture attendu et que l’audio contient l’identifiant/hash de la version scellée.
- [ ] Vérifier qu’aucune URL présignée n’est stockée dans `UserProfile`, `Order`, `ReadingVersion`, `OrderFile` ou `Delivery`.

### Base de données

Effectuer les requêtes avec l’outil d’administration staging, sans exporter de données personnelles :

- [ ] Une seule commande cible, `PAID → PROCESSING → AWAITING_VALIDATION → COMPLETED`.
- [ ] `Order.clientInputs.readingIntake.sealedAt`, `sealedBy: CLIENT`, `contentHash` et `profile` sont présents.
- [ ] Après scellement client, une mutation du profil ne modifie pas `clientInputs.readingIntake`.
- [ ] Une seule version finale `ReadingVersion.status = SEALED` ; PDF/audio/livraison référencent son `id` et son hash.
- [ ] Le job de production est unique pour l’action ; les retries sont tracés mais ne dupliquent ni PDF, ni audio, ni e-mail.

### PDF et audio

- [ ] Ouvrir le PDF depuis le Sanctuaire avec la session client : titre, contenu final et hash/version sont ceux de la version scellée.
- [ ] Écouter l’audio depuis le Sanctuaire avec la session client : même lecture, aucun objet privé n’est exposé dans le DOM.
- [ ] Tester au minimum une erreur de PDF et une erreur audio : l’incident est visible dans le Desk et la relance est idempotente.

## Sécurité et responsive

- [ ] Avec un second client de test, tenter d’appeler les routes photo du premier : refus `401` ou `403`, jamais une image.
- [ ] Avec le token client, appeler une route expert : refus `401` ou `403`.
- [ ] Sans session expert, accéder à `/admin/studio/<orderId>` : redirection connexion.
- [ ] Inspecter le DOM et le réseau : aucune chaîne `s3://`, `X-Amz-Signature`, clé AWS, JWT, lien magique ou secret.
- [ ] Vérifier sur Pixel 5, iPhone 13 et desktop 1440×900 : boutons atteignables, clavier mobile, footer/bouton de scellement visible, navigation basse, modales, upload photo, récapitulatif et messages d’erreur.

## Nettoyage obligatoire

- [ ] Annuler/rembourser la commande Stripe de test selon la procédure staging.
- [ ] Supprimer le client, la commande, les jobs, versions, livraisons et notifications de test via la procédure approuvée.
- [ ] Supprimer les objets S3 privés (visage, paume, PDF, audio) uniquement sous les préfixes explicitement relevés pour ce test.
- [ ] Vérifier après suppression qu’aucun lien direct ne répond encore et consigner le résultat dans le ticket de release.

La recette est validée seulement si chaque étape ci-dessus est datée et attribuée. Toute étape non exécutée doit rester marquée comme telle avec la cause et le risque associé.
