# Contexte produit

Le [README](../README.md) présente la finalité et les fonctionnalités. Ce document
précise les règles utiles au développement, d'après les sources versionnées. Une
intention non implémentée est signalée comme telle dans les [questions ouvertes](KNOWN_ISSUES.md).

## Essais, scores et fiabilité

- L'application lit les essais de presse dans `reviews`. `Score` est le score déjà
  normalisé sur 100 ; la chaîne d'ingestion et les conversions des notes originales
  ne sont pas présentes dans ce repository. La qualité des sources et des conversions
  est donc une exigence produit, pas une garantie démontrée par le frontend.
- Le score est la moyenne arithmétique des scores d'essais du périmètre, sans
  pondération par média. Les moyennes SQL des classements actuels restent précises
  pour le tri ; l’affichage entier est arrondi une seule fois côté présentation.
  Certains champs sont déjà arrondis en SQL (`metacarscore` SEO, extrêmes de
  marque, tendances) : ne pas généraliser « toutes les RPC renvoient du brut ».
  Ne pas calculer le score global par moyenne de moyennes de sources.
- Un score global de véhicule est fiable à partir de **3 médias distincts**, après
  consolidation des alias. Le nombre d'essais affiché reste le volume d'essais,
  distinct du nombre de sources.
- **Exception explicite :** sur les fiches, lorsque les filtres ou la recherche
  activent `isFiltered`, le badge peut afficher un score dès **3 essais**, même
  issus du même média. L'interface le désigne comme « Score Filtré » et affiche
  « Min. 3 essais requis » en attente. Cette exception ne remplace pas le critère
  de fiabilité globale utilisé pour le SEO et les classements.
- Le podium « puissance » ne filtre pas les véhicules sur le nombre de sources ;
  les onglets « score » et « choix raisonnable » le font. Le badge masque un score
  insuffisamment fiable même dans le podium puissance.
- Les catégories de notes sont : positif `>= 75`, mitigé `>= 50 et < 75`, négatif
  `< 50`. Elles ne doivent pas être confondues avec la fiabilité du score.
- Le classement des marques utilise par défaut au moins 5 essais au total ; ses
  meilleurs et pires modèles candidats doivent avoir 3 sources distinctes. L'annuaire
  `/marques` demande `min_count: 1` : ce n'est pas le même seuil que le classement.

Sources : [utils](../src/lib/utils.ts), [ScoreBadge](../src/components/ui/ScoreBadge.tsx),
[GenericPageClient](../src/components/pages/GenericPageClient.tsx),
[DuelArena](../src/components/duels/DuelArena.tsx),
[moyennes SQL](../supabase/migrations/20260904000000_unrounded_score_averages.sql),
[décisions D2 et D3](DECISIONS.md). La normalisation des noms de médias diverge encore
entre SQL et JavaScript : voir Q2 dans les questions ouvertes.

## Identité des véhicules

La navigation suit marque → famille/gamme → année-modèle (`MY`) → modèle →
motorisation. Une année-modèle n'est pas la date de publication d'un essai.

`model_aliases` relie des désignations commerciales à une identité canonique.
Les essais du véhicule canonique et de ses alias sont réunis ; les libellés de
l'essai restent ceux du véhicule testé. Les liens des résultats, tableaux,
annuaires et classements utilisent les attributs canoniques. Les classements et
podiums de modèles distinguent les groupes par identité canonique et `MY`.

Les familles alias de la même marque sont masquées dans son annuaire pour éviter
les doublons ; celles d'une autre marque restent visibles avec leur destination
canonique. L'affichage d'un alias ne doit pas devenir un second véhicule classé.
L'implémentation résout les correspondances déclarées ; elle ne démontre pas la
prise en charge d'un graphe arbitraire de chaînes d'alias.

Sources : [queries](../src/lib/queries.ts), [annuaire SQL](../supabase/migrations/20260830000000_get_families_by_brand_v2.sql),
[table d'essais](../src/components/tables/ReviewsTableCompact.tsx),
[podium](../src/components/dataviz/PodiumWidget.tsx), [D4](DECISIONS.md).

## SEO et contenu éditorial

- Les pages famille, MY et modèle utilisent le critère des 3 sources pour
  l'indexation ; en dessous, elles restent consultables avec `noindex, follow`.
  Les marques sont des annuaires et ne suivent pas ce seuil. Les pages motorisation
  restent `noindex` et ne figurent pas dans le sitemap.
- Le sitemap vise les destinations canoniques éligibles. Sa complétude et les
  redirections permanentes ne sont pas garanties par l'implémentation actuelle
  (Q1 et Q3).
- Les résumés SEO sont générés à partir des statistiques et de la configuration des
  segments. Les formulations françaises, genres, pluriels, égalités de distribution
  et seuil de majorité de 75 % sont centralisés dans `seo-utils.ts`, `MACRO_CONFIG`
  et les tests associés : ne pas maintenir une copie des phrases dans la mémoire.
- Un segment inconnu ne doit pas empêcher le résumé de repli. Les marqueurs internes
  interactifs sont nettoyés avec `cleanSeoText` pour les métadonnées et le JSON-LD.
  Le JSON-LD est sérialisé avec `serializeJsonLd`. Les pages conditionnent
  `aggregateRating` à la présence d'un résumé fiable ; la page modèle conditionne
  également son bloc `review`. Les notes individuelles ne sont pas des scores globaux.

Sources : [seo-utils et tests](../src/lib/seo-utils.ts), [tests SEO](../src/lib/seo-utils.test.ts),
[configuration](../src/lib/constants.ts), [routes](../src/app),
[sitemap](../src/app/sitemap.ts). Le périmètre SEO des motorisations reste une
question ouverte (Q6).
