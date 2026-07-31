# Exploitation SEO et monitoring — Oracle Lumira

## Pré-déploiement

1. Exécuter `pnpm seo:check` après le build : il démarre le bundle standalone et contrôle HTML serveur, sitemap, robots, canonicals, JSON-LD, `noindex`, cache et budget JavaScript initial.
2. Exécuter les contrôles de release habituels (`pnpm db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, Playwright).
3. Vérifier que l'offre dans `packages/shared/src/constants/offer.ts` reste la seule source du prix et des livrables publics avant tout changement de copy.

## Après déploiement

Contrôler avec une fenêtre non authentifiée :

```text
https://oraclelumira.com/
https://oraclelumira.com/notre-approche
https://oraclelumira.com/faq
https://oraclelumira.com/robots.txt
https://oraclelumira.com/sitemap.xml
```

Vérifier les statuts `200`, la canonical absolue, le JSON-LD et les images Open Graph. Vérifier séparément que `/commande`, `/payment-success`, `/sanctuaire/login` et `/admin/login` renvoient `X-Robots-Tag: noindex` et un `Cache-Control` privé. Ne jamais faire ce contrôle avec une URL signée, un token ou une donnée client dans l'historique, les captures ou les logs.

## Search Console et Bing Webmaster Tools

1. Valider la propriété `https://oraclelumira.com` avec une méthode de vérification gérée hors dépôt.
2. Soumettre `https://oraclelumira.com/sitemap.xml` dans Google Search Console et Bing Webmaster Tools.
3. Inspecter les trois URLs indexables après chaque changement substantiel ; demander une indexation seulement après la validation de production.
4. Suivre les pages exclues : les routes Sanctuaire, Desk, API, paiement et login doivent rester exclues. Toute URL privée découverte est un incident à corriger dans l'autorisation applicative puis dans les directives SEO.
5. Consulter les statistiques d'exploration, erreurs robots, erreurs 404 et Core Web Vitals chaque semaine au lancement, puis mensuellement.

## Diagnostic

| Symptôme               | Vérification                                                       | Action                                                                             |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Page non indexée       | Inspection d'URL, canonical, robots HTML/header, sitemap           | Corriger la cause puis demander une nouvelle exploration                           |
| URL privée découverte  | Header `X-Robots-Tag`, middleware, autorisation et logs            | Bloquer l'accès si nécessaire ; `robots.txt` seul ne suffit jamais                 |
| Chute de trafic        | Search Console par page et date, déploiements, erreurs serveur     | Comparer le HTML, les redirects, sitemap et logs d'exploration                     |
| Refonte ou suppression | Cartographier anciennes/nouvelles URLs                             | Ajouter une redirection 308 ciblée ou renvoyer 410 pour une suppression définitive |
| Régression CWV         | CrUX/Search Console et Lighthouse mobile en environnement réaliste | Identifier LCP, INP ou CLS ; ne pas publier de score non mesuré                    |

## Budgets et suivi performance

- Budget CI actuel : JavaScript initial public transféré ≤ 1,5 MB, contrôlé dans `seo.spec.ts`.
- Objectifs terrain au 75e percentile mobile : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
- Le Meta Pixel est chargé en `lazyOnload` et Google Analytics après l'interactivité. Ne pas déplacer ces scripts sur le chemin critique sans mesure comparée.

## Lors d'une future migration Next.js

Revalider : Metadata API, fichiers `robots.ts`/`sitemap.ts`, conventions d'images Open Graph, middleware Edge, règles de cache, `next/image`, bundle standalone, transfert des assets dans Playwright et les tests de cette documentation. Cette migration ne fait pas partie du sprint SEO actuel.
