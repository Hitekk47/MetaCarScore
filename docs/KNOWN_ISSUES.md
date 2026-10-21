# Limites et questions ouvertes

Constats initiaux établis sur `a69e771` à partir du code, des migrations, des tests
et de l'historique. Les vérifications ultérieures sont précisées dans les sections
concernées ; elles ne constituent pas une validation exhaustive de Supabase hébergé.
Ces constats n'autorisent aucune modification fonctionnelle implicite.

## Q3 — Sitemap : portée des alias et validation des destinations

[src/app/sitemap.ts](../src/app/sitemap.ts) conserve un fichier unique et lit
`reviews` et `model_aliases` sans pagination pour les marques/familles/MY ; les
modèles utilisent `get_sitemap_groups_filtered_v4` (décision D8). La vérification
API de cette étude n'a montré aucune troncature. Une erreur de l'une des trois
requêtes interrompt désormais la génération ; ce contrôle ne détecte pas une
réponse réussie mais tronquée.

Le mapping famille ne prend pas en compte toutes les restrictions modèle/MY des
alias. Aucun effet incorrect de cette simplification n'a été constaté sur les
règles examinées, mais le contrat de portée reste à préciser avec Q5.
**Suite proposée :** confronter les règles d'alias aux destinations canoniques et
à leur éligibilité ; aucun contrôle HTTP exhaustif ne garantit ici « 200 OK ».

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


## Validation et garanties à ne pas surévaluer

- Le lint conserve une erreur `no-explicit-any` dans `src/app/[marque]/page.tsx`
  et des avertissements préexistants. Leur correction relève d'une autre tâche.
- Certains tests recopient la logique au lieu d'exécuter le composant réel, et les
  tests de requêtes simulent Supabase. Le fichier historique
  `src/lib/supabase.security.test.ts` n'existe pas. Aucun test de ce nom ne doit être
  cité comme garantie. Aucun workflow de tests applicatifs n'est versionné actuellement.
- Les migrations ne contraignent pas `Score` à `[0,100]` par un `CHECK`, ni les médias
  à un registre certifié. L'ingestion est hors de ce repository : qualité des données
  et conversion des notes originales restent des prérequis amont non vérifiés ici.
- Les statistiques SEO commentent une fenêtre de « 5 dernières MY », mais utilisent
  `MY >= année courante - 5` sans plafond supérieur. Si ce périmètre change, clarifier
  l'inclusion du millésime courant et des millésimes futurs avant de réécrire la règle.
