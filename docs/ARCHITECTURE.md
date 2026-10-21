# Architecture implémentée

## Socle et flux

Next.js 16 (App Router), React 19 et TypeScript strict. Le pipeline CSS utilise
**Tailwind 3**, `tailwind.config.ts`, PostCSS et Autoprefixer ; la présence du paquet
`@tailwindcss/postcss` v4 ne signifie pas qu'il est utilisé. Le client Supabase JS
accède à PostgreSQL/PostgREST. Framer Motion et Lucide fournissent animations et
icônes ; Vercel Analytics et Speed Insights sont intégrés au layout.

Les versions exactes sont celles de [package-lock.json](../package-lock.json),
les commandes celles de [package.json](../package.json). La configuration ESLint
est dans [eslint.config.mjs](../eslint.config.mjs).

| Zone | Responsabilité |
| --- | --- |
| `src/app` | Routes, pages serveur, métadonnées, JSON-LD, robots et sitemap |
| `src/components/pages` | Filtres, annuaires et classements côté client |
| `src/components/duels`, `src/actions/duels.ts` | Comparaison de deux modèles et chargement serveur des essais |
| `src/lib/queries.ts` | Résolution des slugs, alias, lecture des essais et statistiques SEO |
| `src/lib/utils.ts`, `seo-utils.ts`, `constants.ts` | Statistiques d'affichage, règles éditoriales et catégories |
| `supabase/migrations` | Schéma de référence puis évolutions SQL incrémentales |

Les pages véhicule résolvent le contexte puis chargent essais, statistiques et
alias. Les interactions de recherche et de classement appellent aussi Supabase
**depuis le navigateur** : `queries.ts` n'est pas une frontière d'autorisation unique.
`src/lib/supabase.ts` utilise la configuration publique de connexion. Les droits
réels reposent sur PostgreSQL, les politiques RLS et les privilèges des fonctions.

Les helpers de requêtes utilisent `React.cache`. `getFullContext` et
`getVehicleSeoStats` conservent une interface objet mais délèguent à des caches
à arguments primitifs pour partager les RPC entre métadonnées et page dans un
même rendu serveur. Les lectures GET identiques des essais et alias bénéficient
aussi de la mémoïsation de `fetch` par Next ; les RPC POST en sont exclues.
Plusieurs pages ont `revalidate = 3600` ; l'action de duel utilise `unstable_cache`
pendant une heure avec une liste de slugs triée. Le cache React ne persiste pas
entre rendus. Vérifier ces propriétés en contexte serveur : voir le
[diagnostic TEC-009](validation/TEC-009.md) et `scripts/test-query-cache.mjs`.

`SearchBar` cherche les noms canoniques et les alias, affiche les désignations
commerciales et navigue vers les identifiants canoniques. Son historique navigateur
et les portails SEO utilisent des snapshots stables pour respecter l’hydratation.
Préserver cette cohérence sans imposer un hook unique à tous les états React.
Les tooltips de `SeoSummaryCard` utilisent un portail et une position fixe ; cela
ne prouve pas à lui seul leur accessibilité ou leur bon fonctionnement sur mobile.
Les cartes utilisent de vrais liens avec des zones interactives distinctes :
conserver la navigation sémantique sans imbriquer des ancres, sans figer une recette CSS.

## Données et RPC

- `reviews` : essais, identité commerciale, MY, motorisation, source, date et score.
  Les colonnes historiques sont sensibles à la casse : écrire `"Marque"`, `"Famille"`,
  `"Modele"`, `"MY"`, `"Score"`, `"Testeur"` avec les guillemets nécessaires en SQL.
- `model_aliases` : correspondances canonique/alias, éventuellement limitées au MY.
- `model_segments` : macro-catégorie et segment par modèle/MY. Les fonctions de
  classement privilégient la correspondance de MY puis leur repli défini en SQL.

Appels du frontend (chercher les usages avant
une évolution ; une ancienne fonction peut toujours exister dans la base) :

| Usage | RPC appelée |
| --- | --- |
| Contexte | `find_brand_by_slug_v2`, `get_full_context_by_slugs_v3` |
| Familles / recherche | `get_families_by_brand_v2`, `search_cars_v14` |
| Classements | `get_model_ranking_v8`, `get_break_ranking_v6`, `get_convertible_ranking_v6`, `get_brand_ranking_v9` |
| Accueil | `get_homepage_stats`, `get_trending_models_v5` |
| SEO / sitemap modèles | `get_vehicle_seo_stats_v6`, `get_sitemap_groups_filtered_v4` |

Les réponses RPC doivent être interprétées selon leur contrat SQL/PostgREST.
Le générateur SEO convertit certains agrégats avec `Number()` ; ne pas généraliser
que tout nombre arrive en chaîne, ni masquer une valeur absente/invalide par un cast.

Le sitemap conserve un fichier unique et lit directement `reviews` et
`model_aliases` sans pagination pour les marques, familles et MY. Une erreur de
l'une des trois lectures interrompt la génération au lieu de produire un sitemap
partiel. Seule `get_sitemap_groups_filtered_v4` reste comme RPC de sitemap après
la [migration de nettoyage](../supabase/migrations/20261021190000_remove_unused_sitemap_rpcs.sql) ;
les migrations historiques sont conservées (décision D8).
Les limites des trois classements modèle/break/découvrable sont bornées à 100,
celle des tendances à 15, y compris avec `NULL`. Les versions précédentes restent
inchangées et accessibles : voir Q4 dans [KNOWN_ISSUES](KNOWN_ISSUES.md).

## Sécurité et migrations

Le schéma versionné active RLS sur les trois tables. Il autorise la lecture publique
de `reviews` et `model_aliases`, sans politique publique sur `model_segments`.
Certaines fonctions sont `SECURITY DEFINER` : lire leurs privilèges, propriétaire et
`search_path` avant de conclure à l'absence d'accès indirect. `GRANT ALL` sur une
fonction n'accorde que le privilège de fonction disponible (`EXECUTE`) ; sa réécriture
ne prouve pas à elle seule un durcissement. Les privilèges hérités de `PUBLIC`
doivent également être pris en compte.

Les valeurs introduites dans les filtres `.or(...)` sont échappées par
`escapePostgrestValue`. L'action de duel valide tout le lot avant cache/requête :
au plus deux slugs, au plus 256 caractères chacun et un MY à quatre chiffres entre
1900 et 2100. Conserver ces limites et les tests des entrées invalides.

Le snapshot initial sert de référence pour reconstruire le schéma. Ajouter les
évolutions dans de nouvelles migrations ; ne pas rejouer un export complet sur une
base déjà provisionnée. Une migration peut créer de nouveaux objets si nécessaire.
Le workflow [deploy-supabase.yml](../.github/workflows/deploy-supabase.yml) applique
les migrations lors des pushes sur `main` touchant `supabase/migrations/**`.
Un commit Git ne démontre pas que la base distante a reçu cette migration.

## Validation

Avec les outils installés, utiliser selon le changement :

- `npm ci` pour installer depuis le verrou npm ; `npm run dev` pour démarrer.
  Bun est utilisé pour les tests ; aucun second verrou n'est nécessaire.
- `npm run lint` et `npx --no-install tsc --noEmit` pour les contrôles statiques.
  Les fichiers `*.test.*` sont exclus du contrôle TypeScript applicatif.
- `bun test chemin/du/test` pour les tests pertinents. Certains tests utilisent
  `mock.module` et des globals DOM : un échec dépendant de l’ordre des tests
  nécessite de vérifier leur isolation, pas d’imposer par défaut un processus par fichier.
  [SearchBar.test.tsx](../src/components/ui/SearchBar.test.tsx) configure Happy DOM.
  Les tests recopiant une logique ou simulant une RPC ne prouvent pas le comportement
  complet du composant ou de PostgreSQL.
- Pour les limites RPC : [scripts/test-ranking-limits.mjs](../scripts/test-ranking-limits.mjs)
  explique l'installation de PGlite hors dépendances applicatives et exécute
  [ranking_limits.sql](../supabase/tests/ranking_limits.sql). Il rejoue les migrations
  en mémoire avec adaptations des extensions Supabase. Les fixtures SQL tronquent
  des tables : elles sont réservées à une base isolée. Ce n'est pas une validation
  de la base hébergée, de Vault ou du service realtime.
- `npm run build` lorsque pertinent et avec l'environnement requis. Un build qui
  dépend de Supabase ou de ressources externes ne doit pas être présenté comme validé
  si ces prérequis manquent. Ne jamais lancer de migration de production pour tester
  une modification documentaire.
- Pour l'identité des médias, [scripts/test-media-source-identity.mjs](../scripts/test-media-source-identity.mjs)
  rejoue les migrations dans PGlite et vérifie la parité SQL/JavaScript, les huit
  RPC successeures avec les trois rôles publics, les ACL des anciennes versions,
  les moyennes par essai et les limites de classement. Il vérifie ensuite le retrait
  des six RPC de sitemap inutilisées, le blocage en présence d'une dépendance SQL
  et la conservation des fonctions restantes et de leurs ACL. Les fixtures restent
  réservées à cette base isolée ; elles ne valident pas la base hébergée.

Les limites de validation persistantes sont recensées dans [KNOWN_ISSUES](KNOWN_ISSUES.md).
