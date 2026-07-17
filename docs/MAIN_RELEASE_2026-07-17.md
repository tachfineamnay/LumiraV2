# Lumira V2 — livraison principale du 17 juillet 2026

## Référence

Cette livraison réunit sur `main` :

- le Sanctuaire finalisé et son onboarding essentiel ;
- l’accès permanent après achat ;
- les médias et documents privés ;
- le moteur durable de production du Desk ;
- la lecture versionnée et scellée ;
- le PDF privé lié au hash de contenu ;
- l’audio complet lié à la même version ;
- la fiche client 360 ;
- les demandes d’éclairage humaines, séparées du chat IA.

## Variables Coolify obligatoires pour le moteur

```env
PRODUCTION_WORKER_ENABLED=true
PRODUCTION_WORKER_POLL_MS=2500
PRODUCTION_WORKER_CONCURRENCY=2
PRODUCTION_JOB_STALE_MS=900000
PRODUCTION_JOB_MAX_ATTEMPTS=3

AUDIO_ALLOW_LEGACY_FIRE_AND_FORGET=false
AUDIO_GENERATE_INSIGHTS=false
AUDIO_TTS_CHUNK_CHARACTERS=3500
```

Le worker doit être activé sur une seule réplique API tant que son état courant est conservé dans `Order.expertReview`.

La configuration SMTP doit définir explicitement l’hôte, le port, le mode sécurisé, l’utilisateur, le secret et l’adresse d’expédition. Les clés AWS, Google TTS, Stripe, JWT et la clé de chiffrement des réglages ne doivent jamais être présentes dans le dépôt.

## Validation reproductible

```bash
bash scripts/validate-desk-control-center.sh
RUN_PLAYWRIGHT=true bash scripts/validate-desk-control-center.sh
```

La seconde commande nécessite les services et données de test Playwright.

## Ordre de déploiement

1. sauvegarder PostgreSQL ;
2. vérifier les variables Coolify de l’API ;
3. déployer l’API ;
4. vérifier `/api/health` et le log `Production worker started` ;
5. déployer le Web ;
6. vérifier le paiement de test et l’accès immédiat au Sanctuaire ;
7. terminer la préparation en trois étapes ;
8. assigner puis lancer une lecture depuis le Desk ;
9. quitter le Studio et confirmer que le traitement continue ;
10. sceller la lecture et contrôler le PDF privé ;
11. lancer l’audio et contrôler son lecteur privé ;
12. envoyer une demande d’éclairage depuis le Sanctuaire ;
13. répondre depuis `/admin/messages` ;
14. confirmer la réponse dans le Sanctuaire et la notification associée.

## Smoke tests indispensables

- aucun client non authentifié ne peut télécharger un PDF, un audio ou une photo ;
- une commande payée conserve l’accès permanent même après un incident de production ;
- deux clics de lancement ne produisent pas deux jobs actifs ;
- un redémarrage API récupère un job abandonné ;
- une annulation ne peut viser que le job courant en attente ;
- le PDF et l’audio correspondent à la dernière `ReadingVersion` scellée ;
- le chat IA ne peut jamais ouvrir ou modifier une demande humaine ;
- une demande humaine ne contient pas son texte privé dans les notifications ou la chronologie ;
- un échec secondaire de notification ne provoque pas une réponse expert dupliquée.

## Rollback

Le chantier Desk n’ajoute pas de migration destructive. En cas d’incident applicatif, redéployer le commit principal précédent après avoir attendu, annulé ou laissé terminer les jobs actifs. Les clés JSON ajoutées dans `Order.expertReview` restent ignorables par l’ancien code.
