# Exploitation SEO — Oracle Lumira

Le déploiement officiel du Web suit directement la branche `main` dans Coolify. GitHub Actions, webhook Coolify et secrets GitHub ne font pas partie de ce flux.

## Contrôles locaux

```bash
pnpm seo:check
```

Cette commande construit le Web avec des identifiants publics de test inoffensifs, génère la matrice des routes depuis `apps/web/app`, démarre le bundle standalone avec ses assets et exécute le contrat Playwright.

## Contrôle de production

```bash
pnpm seo:check:deployed
```

Il contrôle uniquement les domaines publics, sans envoyer de donnée client. La révision servie est informative par défaut. Pour attendre un déploiement précis :

```bash
EXPECTED_REVISION=<sha> pnpm seo:check:deployed
```

Le script devient alors strict sur la valeur exposée par `GET /api/version`.

## Règles SEO immuables

- `https://oraclelumira.com` est le domaine canonique.
- Le sitemap contient uniquement `/`, `/notre-approche` et `/faq`.
- Les pages transactionnelles, Sanctuaire, API et Desk sont `noindex` et `no-store`.
- `https://desk.oraclelumira.com/robots.txt` contient uniquement `Disallow: /` et son sitemap répond `404`.
- Les services Analytics et Meta ne sont chargés qu’après consentement explicite, sur les seules pages publiques non transactionnelles.

Ne jamais lancer ces contrôles avec une URL signée, un token ou une donnée client dans l’URL, les captures ou les logs.
