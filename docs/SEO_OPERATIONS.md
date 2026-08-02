# Exploitation SEO et monitoring — Oracle Lumira

## Pré-déploiement

1. Exécuter `pnpm seo:check` : la commande reconstruit le Web puis lance les contrôles Playwright contre `next start`, jamais contre `next dev`.
2. En CI, après le build unique du Web, exécuter `pnpm seo:check:built` pour contrôler ce même build sans le reconstruire.
3. Exécuter les contrôles de release habituels (`pnpm db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, Playwright).
4. Vérifier que l'offre dans `packages/shared/src/constants/offer.ts` reste la seule source du prix et des livrables publics avant tout changement de copy.

## Après déploiement

Contrôler avec une fenêtre non authentifiée :

```text
https://oraclelumira.com/
https://oraclelumira.com/notre-approche
https://oraclelumira.com/faq
https://oraclelumira.com/robots.txt
https://oraclelumira.com/sitemap.xml
```

Vérifier les statuts `200`, la canonical absolue et le JSON-LD public. Vérifier séparément que `/commande`, `/payment-success`, `/sanctuaire/login`, `/admin/login` et `/api/health` renvoient `X-Robots-Tag: noindex` et un `Cache-Control: private, no-store`. Vérifier enfin que `https://desk.oraclelumira.com/robots.txt` contient uniquement `Disallow: /`, que son sitemap retourne `404` et que ses pages n'ont ni canonical publique ni JSON-LD. Ne jamais faire ce contrôle avec une URL signée, un token ou une donnée client dans l'historique, les captures ou les logs.

## Révision et déploiement Coolify

Le service Web expose `GET /api/version`, qui ne contient que `revision` et `service`, avec `noindex` et `no-store`. Dans Coolify, définir `APP_REVISION` comme variable de build et de runtime avec le SHA du commit réellement construit (par exemple la variable de commit fournie par Coolify). Le workflow GitHub refuse le déploiement si cette valeur ne correspond pas à `github.sha`, même si le webhook Coolify a accepté la demande.

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

## Suivi performance

- Objectifs terrain au 75e percentile mobile : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
- Le Meta Pixel est chargé en `lazyOnload` et Google Analytics après l'interactivité. Ne pas déplacer ces scripts sur le chemin critique sans mesure comparée ; aucune dépendance Lighthouse n'est intégrée sans une mesure reproductible.

## Lors d'une future migration Next.js

Revalider : Metadata API, fichiers `robots.ts`/`sitemap.ts`, middleware Edge, règles de cache, `next/image`, bundle standalone, transfert des assets dans Playwright et les tests de cette documentation. Cette migration ne fait pas partie du sprint SEO actuel.
