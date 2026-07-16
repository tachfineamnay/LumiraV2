---
name: lumira-payments-auth-security
description: Sécuriser, corriger ou tester Stripe, webhooks, auth client/expert, liens magiques, JWT, cookies, S3 et secrets Lumira. À utiliser pour checkout, paiement, session, permissions, données sensibles, uploads ou toute modification exposée à Internet.
---

# Lumira — Paiements, authentification et sécurité

## Modèle de confiance

- Le navigateur n'est jamais une source de vérité pour le prix, le produit, le statut payé, le rôle ou les entitlements.
- Stripe prouve le paiement ; la base prouve l'état durable ; les guards API prouvent l'autorisation.
- Une redirection `success_url` n'est pas une preuve de paiement.
- Toute action sensible doit être refusée côté serveur par défaut.

## Stripe

- Créer la session à partir du catalogue et des Price IDs configurés côté serveur.
- Vérifier session, mode de paiement, montant, devise, métadonnées et identité avant de délivrer une session Sanctuaire.
- Utiliser le `rawBody` pour la signature des webhooks.
- Enregistrer les événements traités avec `ProcessedEvent` ou le mécanisme existant avant les effets non idempotents.
- Un retry Stripe ne doit pas créer deux commandes, deux utilisateurs, deux fichiers ou deux e-mails.
- Ne pas remettre une logique d'abonnement récurrent dans le parcours actuel d'accès à vie.

## Liens magiques et JWT

- Générer un token cryptographiquement fort.
- Stocker uniquement son hash SHA-256 ou le mécanisme actuel équivalent.
- Expiration courte, consommation atomique et usage unique.
- Réponse générique pour adresse inconnue ou non payée.
- Les JWT client et expert doivent garder des durées, claims, cookies et guards distincts.
- Utiliser les helpers de session/cookie existants ; ne pas créer un troisième schéma d'auth parallèle.
- Vérifier les attributs de cookie appropriés : `HttpOnly`, `Secure` en production, `SameSite`, chemin et durée.

## API et permissions

- Valider les DTO avec les pipes NestJS existants.
- Vérifier la propriété des ressources : un client ne lit que ses commandes, fichiers, rêves, chat et profil.
- Réserver paramètres globaux, secrets et gestion des experts au rôle adéquat.
- Ne pas exposer stack traces, secrets, token brut, hash sensible, clé S3 ou configuration provider.
- Conserver throttling et protections contre brute force sur login et lien magique.

## Uploads et S3

- Valider MIME réel attendu, taille, type métier et ownership.
- Générer les clés serveur ; ne pas accepter une clé S3 arbitraire du client.
- Utiliser des URLs signées courtes pour le privé et un stream authentifié lorsque prévu.
- Ne pas persister une URL signée temporaire comme référence permanente.
- Lors d'un remplacement, éviter les fichiers orphelins ou suppressions avant confirmation de la nouvelle écriture.

## Configuration

- Lire les secrets via `ConfigService` ou le service de paramètres sécurisé.
- Les clés administrables stockées en base doivent utiliser le chiffrement existant et être masquées dans les réponses.
- Ne jamais ajouter de valeur réelle dans `.env.example`, fixtures, tests, logs ou messages d'erreur.
- Échouer clairement au démarrage ou à l'usage lorsqu'une variable critique manque ; ne pas utiliser de secret faible par défaut.

## Tests de sécurité minimum

- webhook signé, signature invalide et événement rejoué ;
- session Stripe payée, non payée et montant incohérent ;
- lien magique valide, expiré, réutilisé et concurrent ;
- client tentant d'accéder à la ressource d'un autre ;
- client sur endpoint expert et expert insuffisamment autorisé ;
- upload invalide, surdimensionné et non possédé ;
- absence de secret critique sans fuite de valeur.

## Critères d'acceptation

- Aucun accès Sanctuaire sans preuve de paiement durable.
- Aucun effet externe dupliqué sur retry.
- Les rôles et propriétaires sont contrôlés côté API.
- Les secrets restent côté serveur et masqués.
- Les tests prouvent les refus, pas seulement le cas nominal.
