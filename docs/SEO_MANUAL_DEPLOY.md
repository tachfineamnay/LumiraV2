# Déploiement SEO manuel avec Coolify

Le service Web est déployé directement par Coolify depuis la branche `main`. GitHub Actions n’est ni requis ni utilisé.

## Préparation locale

Depuis la racine du dépôt :

```bash
git status
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm seo:check
git diff --check
```

Lancer les tests API ciblés uniquement si le code API a été modifié. Ne jamais inclure un changement local non lié dans le commit de release.

## Une seule fois dans GitHub

Dans **Settings → Rules / Branch protection → main**, retirer les checks requis hérités des anciens workflows `ci` et `deploy`. Aucun webhook, token Coolify ou secret GitHub ne doit être configuré pour le déploiement Web.

## Publication

```bash
git add -- <fichiers-seo-vérifiés>
git diff --cached --check
git commit -m "fix(seo): finalize manual production delivery"
git push origin main
```

N'utilisez pas `git add .` si le répertoire contient des modifications locales hors du chantier de release.

Dans Coolify :

1. Ouvrir le service Web et vérifier que la branche suivie est `main`.
2. Définir comme **Build Variables** : `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_META_PIXEL_ID` (optionnel), `NEXT_PUBLIC_GA_ID` (optionnel) et `APP_REVISION` (optionnel).
3. Conserver `API_INTERNAL_URL` et `JWT_SECRET` comme variables d’exécution existantes ; ils ne sont jamais des variables publiques.
4. Cliquer **Redeploy**. Utiliser un rebuild sans cache seulement après une modification des variables de build ou si Coolify réutilise un artefact obsolète.
5. Attendre le healthcheck Web : `GET /api/health`.

`APP_REVISION` peut rester `unknown` pour un redeploy manuel. S’il est renseigné, fournir la même valeur à la construction et à l’exécution.

## Après déploiement

```bash
pnpm seo:check:deployed
```

Pour contrôler une révision attendue :

```bash
EXPECTED_REVISION=<sha> pnpm seo:check:deployed
```

Vérifier aussi dans une fenêtre non authentifiée :

```text
https://oraclelumira.com/
https://oraclelumira.com/faq
https://oraclelumira.com/notre-approche
https://oraclelumira.com/robots.txt
https://oraclelumira.com/sitemap.xml
https://desk.oraclelumira.com/robots.txt
```

## Rollback

Dans Coolify, ouvrir les déploiements du service Web, sélectionner l’image saine immédiatement précédente et utiliser l’action de restauration/redeploy de cette image. Attendre le healthcheck, puis lancer `pnpm seo:check:deployed`. Ne modifiez ni la base PostgreSQL, ni les secrets, ni les fichiers clients pour un rollback SEO.
