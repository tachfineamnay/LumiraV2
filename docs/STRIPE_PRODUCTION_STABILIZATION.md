# Stabilisation Stripe production

## Cause confirmee le 2026-07-29

Le bundle public de `/commande` embarquait une cle Stripe publiable de test,
alors que l'API cree des PaymentIntents live. Stripe.js ne peut pas monter un
Payment Element avec ces environnements differents. Le symptome est l'attente
infinie du module, sans debit confirme.

## Correctifs inclus

- une tentative navigateur opaque est persistante et idempotente cote serveur ;
- le navigateur doit prouver le `client_secret` avant toute finalisation ;
- les retours 3DS, reseau et webhooks rejouent le meme fulfillment idempotent ;
- l'acces Sanctuaire fixe est repare a chaque confirmation Stripe reussie ;
- l'image web refuse une cle `pk_test_` lorsque l'API de production est ciblee ;
- `pnpm --dir apps/api reconcile:stripe-payments` analyse sans modifier ;
  ajouter `-- --apply` active uniquement le fulfillment idempotent des intents
  deja reussis.

## Actions Coolify requises avant de deployer

1. Definir `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` avec une cle `pk_live_` et la
   rendre disponible au build du service web.
2. Rebuild complet du service web ; une variable `NEXT_PUBLIC_*` est figee dans
   le bundle Next.js.
3. Verifier que `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` de l'API sont
   live et correspondent au meme compte Stripe, sans imprimer leurs valeurs.
4. Ajouter aux evenements du webhook : `payment_intent.processing`,
   `payment_intent.payment_failed` et `payment_intent.canceled`, en plus de
   `payment_intent.succeeded`.
5. Apres deploy, executer d'abord la reconciliation en lecture seule puis un
   paiement de test controle dans le bon mode Stripe.
