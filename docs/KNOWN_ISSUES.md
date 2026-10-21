# Limites et questions ouvertes

Constats établis sur `a69e771` à partir du code, des migrations, des tests et de
l'historique. L'impact sur les données réelles et l'état Supabase hébergé n'ont pas
été vérifiés. Ces constats n'autorisent aucune modification fonctionnelle implicite.

## Q1 — Redirections annoncées permanentes

**Intention intégrée :** la PR [#81](https://github.com/Hitekk47/MetaCarScore/pull/81)
annonce des 308 vers les URL canoniques. **Implémentation :** les quatre pages sous
`src/app/[marque]/[famille]` appellent `redirect(url, RedirectType.replace)`, et non
`permanentRedirect`. Dans ce contexte Next.js, l'appel utilise la redirection
307 (le rendu en streaming peut utiliser une balise de redirection) ; `replace`
concerne l'historique de navigation, pas le statut 308. L'incohérence est confirmée
par le code, sans mesure HTTP de production. Prévoir une correction et un test de
navigation/statut dédiés ; ne pas documenter des 308 comme déjà garantis.

## Q2 — Identité d'un média non uniformisée

Les RPC comptent `COUNT(DISTINCT TRIM("Testeur"))`, sensible à la casse ;
`getDistinctSourceCount` dans [utils](../src/lib/utils.ts) applique aussi `toLowerCase`.
Trois variantes de casse peuvent donc être trois sources en SQL et une en UI.
Les valeurs vides/blanches sont également traitées différemment dans le sitemap.
**À décider :** identité normalisée d'un média et traitement des valeurs manquantes.
Puis aligner SQL, UI, SEO et tests sur ce contrat, sans confondre médias et essais.

## Q3 — Sitemap : complétude et canonicalisation non garanties

[src/app/sitemap.ts](../src/app/sitemap.ts) lit `reviews` et `model_aliases` sans
pagination pour les marques/familles/MY ; seule la liste des modèles utilise
`get_sitemap_groups_filtered_v3`. La RPC `get_sitemap_canonical_routes_v2` existe
mais n'est pas appelée. Le plafond effectif PostgREST est inconnu ici : une
troncature peut rendre les routes et comptages incomplets. Le mapping famille ne
prend pas en compte toutes les restrictions modèle/MY des alias.
**Suite proposée :** vérifier la pagination et les règles d'alias, puis valider que
chaque URL émise est canonique et éligible ; ne pas supposer la garantie « 200 OK ».

## Q4 — Anciennes RPC de classement encore non bornées

[#88](https://github.com/Hitekk47/MetaCarScore/pull/88) conserve volontairement les
15 anciennes RPC avec leur comportement `LIMIT NULL` non borné. Le frontend appelle
les quatre nouvelles versions bornées ; les anciennes restent accessibles. Le
[test SQL](../scripts/test-ranking-limits.mjs) démontre cette compatibilité.
**À décider :** calendrier et conditions de retrait/révocation après inventaire des
consommateurs. Les bornes de résultats ne limitent pas à elles seules le coût de
calcul ni la fréquence des requêtes.

## Q5 — Portée et ambiguïtés des alias

`getReviews` filtre les règles par `canonical_my` pour sélectionner les entités,
mais annote ensuite les essais avec la liste d'alias non filtrée. Plusieurs RPC
actuelles n'appliquent pas ce champ dans leurs jointures. Certaines résolutions de
modèle se replient sur `LIMIT 1` sans ordre déterministe ; le schéma n'interdit pas
les règles d'alias concurrentes. Il existe donc un risque de regroupement hors MY,
de choix ambigu ou de multiplication de lignes, selon les données. Les chemins de
consolidation de l’annuaire et des pages marque diffèrent aussi : l’égalité de leurs
compteurs n’est pas démontrée pour toutes les configurations d’alias.
**À décider :** contrat de portée MY, priorité et unicité des règles ; le confronter
aux données autorisées avant toute correction. Sources : [queries](../src/lib/queries.ts),
[classements actuels](../supabase/migrations/20261020000000_bound_public_ranking_limits.sql),
[schéma](../supabase/migrations/20260827171821_remote_schema.sql).

## Q6 — Périmètre SEO des motorisations

La [page motorisation](../src/app/[marque]/[famille]/[my]/[modele]/[powertrain]/page.tsx)
filtre les essais affichés mais demande les statistiques SEO au niveau modèle.
Elle reste `noindex`, sans que cela empêche le texte ou le JSON-LD de refléter un
périmètre plus large. **À décider :** conserver le contexte modèle explicitement
ou produire des statistiques propres à la motorisation.

## Q7 — Exception bZ4X dans les breaks

`get_break_ranking_v5` exclut explicitement les modèles correspondant à `%bZ4X%`.
L'exception est présente dans le schéma initial, restaurée dans [#78](https://github.com/Hitekk47/MetaCarScore/pull/78)
et conservée depuis. Aucune justification produit n'a été retrouvée dans les
sources examinées. **Arbitrage :** confirmer sa raison et sa pérennité ; ne pas la
supprimer ni la généraliser à une règle de carrosserie sans cette décision.

## Q8 — Texte des égalités de distribution

La mémoire historique décrit des phrases commençant par « Les avis sont partagés… ».
[seo-utils.ts](../src/lib/seo-utils.ts) préfixe actuellement la distribution par
« Les avis sont majoritairement », y compris dans les branches d'égalité. Les
[tests SEO](../src/lib/seo-utils.test.ts) vérifient surtout des fragments, ce qui ne
prouve pas la conformité de la phrase complète. **Arbitrage :** confirmer la
formulation souhaitée, puis tester le texte complet avant correction éditoriale.

## Validation et garanties à ne pas surévaluer

- À la révision examinée, le lint a 6 erreurs `no-explicit-any` (`src/app/[marque]/page.tsx`
  et `src/lib/utils.test.ts`) et 7 avertissements. Ils préexistent à la migration
  documentaire ; leur correction relève d'une autre tâche.
- Certains tests recopient la logique au lieu d'exécuter le composant réel, et les
  tests de requêtes simulent Supabase. Le fichier historique
  `src/lib/supabase.security.test.ts` n'existe pas. Aucun test de ce nom ne doit être
  cité comme garantie. Aucun workflow de tests applicatifs n'est versionné actuellement.
- Les migrations ne contraignent pas `Score` à `[0,100]` par un `CHECK`, ni les médias
  à un registre certifié. L'ingestion est hors de ce repository : qualité des données
  et conversion des notes originales restent des prérequis amont non vérifiés ici.
- Les journaux d'erreur ne sont pas tous neutralisés : certains chemins de
  `queries.ts` et de la page marque loguent encore des objets d'erreur/débogage.
  Ne pas affirmer une absence exhaustive de données sensibles dans les logs.
- Les statistiques SEO commentent une fenêtre de « 5 dernières MY », mais utilisent
  `MY >= année courante - 5` sans plafond supérieur. Si ce périmètre change, clarifier
  l'inclusion du millésime courant et des millésimes futurs avant de réécrire la règle.
