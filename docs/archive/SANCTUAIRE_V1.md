# Sanctuaire V1 — archive fonctionnelle

Ce document préserve le périmètre de l'ancien Sanctuaire afin qu'il ne soit
pas réintroduit par erreur dans le parcours client actuel. Il ne décrit pas
la source d'autorisation actuelle : celle-ci reste une commande `PAID` et
l'accès à vie qui en découle.

## Éléments retirés du parcours actif

- Mandala et navigation cosmétique associée ;
- Chemin, étapes, niveaux et gamification ;
- journal des rêves et interprétations de rêves ;
- abonnement, résiliation, offres, upsells et badge « Initié » ;
- tirages futurs, « Mes Révélations » et création de nouvelle lecture ;
- Oracle présenté comme un chatbot illimité ou une fonctionnalité premium.

Les composants historiques peuvent subsister temporairement dans le dépôt,
sans import depuis les écrans actifs, pour conserver la compatibilité des
builds et faciliter un inventaire ultérieur. Ils ne doivent pas être réactivés
sans décision produit, parcours complet et couverture de tests.

Inventaire des dépendances V1 encore présentes mais sorties du parcours actif :
`MandalaNav`, `TimelineConstellation`, `HolisticWizard`, `OracleOnboardingChat`,
`CapabilityGuard`, `SubscriptionGuard` et `SubscriptionLock`. Les modèles et
endpoints legacy restent également documentés comme compatibilité, sans devenir
une source de droits ou une destination de navigation cliente.

## Compatibilité des routes

Les anciennes URL sont maintenues par redirection plutôt que supprimées :

| Ancienne route                                                            | Destination actuelle               |
| ------------------------------------------------------------------------- | ---------------------------------- |
| `/sanctuaire/path`                                                        | `/sanctuaire/synthesis`            |
| `/sanctuaire/reves`, `/sanctuaire/reves/nouveau`, `/sanctuaire/reves/:id` | `/sanctuaire/synthesis`            |
| `/sanctuaire/abonnement`                                                  | `/sanctuaire/profile`              |
| `/sanctuaire/settings/billing`                                            | `/sanctuaire/settings/preferences` |

Les modèles Prisma, endpoints historiques et tables de compatibilité ne sont
ni supprimés ni utilisés comme source d'autorisation par cette évolution. Une
suppression demanderait un inventaire des usages, une migration versionnée et
des tests de non-régression.

## Architecture active depuis V2

- navigation : Accueil, Mes lectures, Ma synthèse, Demander un éclairage ;
- profil : accessible depuis l'avatar, avec badge « Accès à vie » ;
- préparation : données de naissance, photos privées facultatives et
  consentement explicite, sauvegardés côté serveur ;
- livraison : PDF et audio privés, accessibles uniquement après contrôle
  d'appartenance côté API ;
- synthèse : au plus quatre sections dérivées de données réellement générées
  et validées ;
- éclairage : conservation de l'historique de la dernière conversation, sans
  promesse de disponibilité illimitée.

## Décision produit durable

Le Sanctuaire correspond au premier achat ponctuel validé. Il ne présente ni
abonnement mensuel, ni accès à des offres futures, ni verrouillage par niveau.
Les liens magiques existants à usage unique restent la méthode de connexion
client ; l'authentification du Desk expert demeure distincte.
