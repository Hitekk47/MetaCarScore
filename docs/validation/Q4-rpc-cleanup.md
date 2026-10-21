# Q4 — Retrait des fonctions SQL inutilisées

Décision explicite du mainteneur le 21 octobre 2026 : aucun autre client ne
consomme les fonctions du projet ; supprimer celles qui ne sont plus utilisées
par le repository. La compatibilité historique conservée dans #88 n'est donc
plus une raison de garder ces endpoints en base.

## Inventaire et périmètre

Le rejeu des migrations jusqu'à Q3 (#94, `77a7a52`) produit
**49 fonctions propres au projet**.
L'inventaire des appels dans `src`, y compris le nom par défaut et les props
`customRpcName` des classements, en conserve **12**. L'analyse des corps SQL
conserve aussi **`slugify_text(text)`**, appelée par les RPC de contexte et de
résolution de marque, et **`normalize_media_source(text)`**, utilisée par les
RPC de classement, SEO et sitemap. Les fonctions des extensions, dont `unaccent`,
restent intactes. Les autres fonctions applicatives ne sont utilisées ni par ces RPC,
ni par les vues, politiques, contraintes ou triggers versionnés.

| Fonctions conservées | Consommateur |
| --- | --- |
| `find_brand_by_slug_v2`, `get_full_context_by_slugs_v3`, `get_families_by_brand_v2`, `get_vehicle_seo_stats_v6` | `src/lib/queries.ts` |
| `search_cars_v14` | `src/components/ui/SearchBar.tsx` |
| `get_model_ranking_v8` | `src/components/pages/GenericTopRankingClient.tsx` (nom par défaut) |
| `get_break_ranking_v6`, `get_convertible_ranking_v6` | Props des pages `src/app/tops/breaks/page.tsx` et `decouvrables/page.tsx` |
| `get_brand_ranking_v9` | `src/components/pages/TopMarquesClient.tsx`, `src/app/marques/page.tsx` |
| `get_homepage_stats`, `get_trending_models_v5` | `src/app/page.tsx` |
| `get_sitemap_groups_filtered_v4` | `src/app/sitemap.ts` |
| `slugify_text` | Corps SQL de `find_brand_by_slug_v2` et `get_full_context_by_slugs_v3` |
| `normalize_media_source` | Corps SQL des classements, du SEO et du sitemap courants (Q2) |

La [migration incrémentale](../../supabase/migrations/20261021200000_drop_unused_public_functions.sql)
supprime **35 fonctions** avec leurs signatures exactes :

| Fonctions retirées | Nombre |
| --- | ---: |
| `find_brand_by_slug`, `get_families_by_brand`, `get_full_context_by_slugs`, `get_full_context_by_slugs_v2`, `search_cars_v13` | 5 |
| `get_brand_ranking_v3` à `v8` | 6 |
| `get_model_ranking_v3` à `v7` | 5 |
| `get_break_ranking`, puis `v2` à `v5` | 5 |
| `get_convertible_ranking`, puis `v2` à `v5` | 5 |
| `get_trending_models`, puis `v2` à `v4` | 4 |
| `get_vehicle_seo_stats`, puis `v2` à `v5` | 5 |

`find_family_by_slug`, `find_model_by_slug` et `find_type_by_slug` ont déjà été
supprimées par `20260827200000_jules.sql`. Le benchmark simulé utilise désormais
le nom courant du contexte ; son ancien libellé n'était pas un appel distant.
Les six anciennes RPC de sitemap sont déjà retirées par la migration Q3
`20261021190000_remove_unused_sitemap_rpcs.sql` ; seule la version filtrée `v4`
reste nécessaire.
Les définitions des anciennes fonctions restent dans les migrations historiques
pour permettre le rejeu ; elles n'existent plus dans le schéma final migré.

## Validation et mise en service

[Le runner SQL](../../scripts/test-ranking-limits.mjs) vérifie la compatibilité
historique de #88, puis rejoue toutes les migrations suivantes. Pour le nettoyage,
il confronte l'inventaire aux appels applicatifs, contrôle la disparition des
35 signatures pour `anon`, `authenticated` et `service_role`, et compare strictement
les fonctions conservées avant/après : OID, définition, propriétaire, ACL et
propriétés de sécurité. Il compare aussi leurs résultats sur des fixtures non
vides pour ces trois rôles, en exerçant les deux helpers SQL, puis rejoue les 120 cas de
bornes et les régressions alias/MY sur le schéma final.
Une vue de test dépendante bloque le retrait et vérifie l'absence de suppression
partielle ou en cascade.

Le test utilise PostgreSQL en mémoire via PGlite, sans URL ni identifiants
Supabase. Il ne vérifie ni la base hébergée ni le cache de schéma PostgREST.
La migration émet `NOTIFY pgrst, 'reload schema'` pour demander son actualisation.

Le retrait doit être appliqué après la mise en service du client utilisant les
versions actuelles (Q2 / #93). Les retours applicatifs à des versions appelant les
anciens noms nécessitent de restaurer leurs fonctions. Le `DROP` unique est
atomique et utilise `RESTRICT`, sans suppression en cascade ; une dépendance
enregistrée inattendue fait échouer la migration. Les corps PL/pgSQL ne sont pas
tous suivis par `pg_depend`, d'où l'analyse SQL et les appels réels du test.

Les fonctions inconnues du schéma versionné ne sont pas supprimées par déduction.
L'application effective de la migration à une base distante reste à vérifier
dans le pipeline Supabase. Ce nettoyage ferme les anciens endpoints non bornés ;
les plafonds de résultats ne bornent toujours pas à eux seuls le coût des calculs
ou la fréquence des requêtes.

Vérification locale : runners SQL Q2/Q3 et Q4 réussis sur PostgreSQL 18.6 /
PGlite 0.5.11, 116 tests Bun réussis, TypeScript et contrôle des espaces réussis. Le lint des
deux scripts modifiés ne produit aucune erreur ; les trois avertissements de
paramètres inutilisés du benchmark simulé préexistent à ce changement.
