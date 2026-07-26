# Production IA Lumira

`MODEL_CONFIG` est l’unique source opérationnelle du provider, modèle, niveau
de réflexion et budget de sortie. Les preuves de capacité viennent des probes
persistées ; `AiRoutingRuleLegacy` est uniquement une archive de rollback et
ne participe à aucune exécution.

## Workflow canonique

`ReadingIntake` scellé → préparation et validation d’images privées →
observations visibles → SCRIBE → validation déterministe → EDITOR si nécessaire
→ GUIDE dans `ReadingVersion.DRAFT` → revue experte → `ReadingVersion.SEALED`
→ parcours, PDF, e-mail puis audio.

- **SCRIBE** produit la lecture structurée et utilise les observations visibles,
  jamais des détails de visage ou de paume inventés.
- **EDITOR** modifie un bloc avec son contexte et compare la révision au moment
  de la persistance.
- **GUIDE** reste dans le brouillon ; ses `PathStep` ne sont créés qu’au
  scellement et sont liés à la version scellée.

Les images passent par le stockage privé, vérification du type réel, décodage,
dimensions, orientation, rôle et hash. Les snapshots `AiRun` ne retiennent que
des hashes, rôles, compteurs et métadonnées techniques ; aucun prompt ou PII.

## Jobs, livraison et rollback

`ProductionControlService` est l’unique entrée des générations longues. Les
jobs persistants passent de `QUEUED` à `RUNNING`, puis à succès ou échec. Un
candidat n’est promu qu’après validation ; `BLOCKED` reste non promouvable. Une
régénération garde le brouillon et la lecture livrée précédents jusqu’à la
promotion atomique.

Au déploiement, appliquer `prisma migrate deploy` avant le démarrage. Le runner
Docker vérifie que `sharp` charge et décode un PNG. En rollback, revenir au
code précédent et, seulement si nécessaire, renommer manuellement
`AiRoutingRuleLegacy` en `AiRoutingRule` avant de redéployer ce code ancien.
