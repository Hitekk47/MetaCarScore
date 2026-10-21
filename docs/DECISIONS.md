# Décisions durables

Les références ci-dessous retracent des changements intégrés à Git. Une PR fusionnée
atteste l'adoption du changement ; elle ne prouve ni le déploiement de la base ni
une approbation humaine séparée de chaque détail. Les incertitudes restent dans
[KNOWN_ISSUES](KNOWN_ISSUES.md). Les contrats actuels figurent dans le
[contexte produit](PROJECT_CONTEXT.md) et l'[architecture](ARCHITECTURE.md).

| Décision | Justification et solution remplacée | Sources |
| --- | --- | --- |
| **D1 — Conserver le pipeline Tailwind 3 actuel.** | Le passage implicite à v4 a été évité pour prévenir les ruptures. Une migration future reste possible comme changement explicite. | Commit [`abd2391`](https://github.com/Hitekk47/MetaCarScore/commit/abd2391), `postcss.config.mjs`, `tailwind.config.ts` |
| **D2 — Fiabilité globale par pluralité des médias, exception pour le score filtré.** | Trois essais d'une seule source ne suffisent plus au score global. Le score filtré conserve délibérément le seuil de trois essais. | [#85](https://github.com/Hitekk47/MetaCarScore/pull/85), [#86](https://github.com/Hitekk47/MetaCarScore/pull/86), commits `cd5c454`, `2e209e1` |
| **D3 — Préserver la précision du classement et arrondir une fois pour l'affichage.** | Évite la dérive du double arrondi (`83,46 → 83,5 → 84`) et corrige le duel qui faisait une moyenne des moyennes par source. La moyenne porte sur les essais. | [#87](https://github.com/Hitekk47/MetaCarScore/pull/87), commit `5b9cbea` |
| **D4 — Consolider les véhicules rebadgés sous une identité canonique.** | Évite de fragmenter essais et scores entre noms commerciaux, conserve les noms réellement testés à l'affichage et dirige les URL d’alias vers les URL canoniques. | [#74](https://github.com/Hitekk47/MetaCarScore/pull/74), [#78](https://github.com/Hitekk47/MetaCarScore/pull/78), [#79](https://github.com/Hitekk47/MetaCarScore/pull/79), [#81](https://github.com/Hitekk47/MetaCarScore/pull/81), [#83](https://github.com/Hitekk47/MetaCarScore/pull/83), [#84](https://github.com/Hitekk47/MetaCarScore/pull/84) |
| **D5 — Faire évoluer les RPC par versions additives.** | Permet d'appliquer la migration avant le client et de conserver les clients précédents pendant la transition. La modification en place ou la suppression immédiate des anciennes fonctions a été écartée dans #88. Leur retrait ultérieur doit être décidé séparément (Q4). | [#78](https://github.com/Hitekk47/MetaCarScore/pull/78), [#88](https://github.com/Hitekk47/MetaCarScore/pull/88), commit `a69e771`, `scripts/test-ranking-limits.mjs` |
| **D6 — Maintenir l’exclusion bZ4X du classement des breaks.** | La version bZ4X Touring est un SUV rallongé, pas un break. Le nom « Touring » ne justifie donc pas son inclusion. Conserver le filtre explicite `%bZ4X%` actuellement implémenté. | Arbitrage explicite du mainteneur le 21 octobre 2026 ; `get_break_ranking_v5` dans la [migration actuelle](../supabase/migrations/20261020000000_bound_public_ranking_limits.sql) ; [#78](https://github.com/Hitekk47/MetaCarScore/pull/78) |
| **D7 — Une identité de média insensible à la casse et aux espaces de bord.** | Un nom normalisé vide ne compte pas comme source. Accents, ponctuation et espaces internes restent significatifs. Les essais conservent leur poids individuel dans les volumes et les moyennes ; le seuil du score filtré reste de 3 essais. | Arbitrage explicite du mainteneur le 21 octobre 2026 ; [contrat UI](../src/lib/media-source.ts), [migration SQL](../supabase/migrations/20261021000000_uniform_media_source_identity.sql), `scripts/test-media-source-identity.mjs` |
| **D8 — Conserver le sitemap unique sans pagination et retirer ses RPC inutilisées.** | Le volume et le délai de génération sont acceptés. Une erreur de lecture doit interrompre la génération. Seule `get_sitemap_groups_filtered_v4` est conservée ; le mainteneur confirme l'absence d'autres clients des versions retirées. Les limites de portée des alias restent dans Q3/Q5. | Arbitrage explicite du mainteneur le 21 octobre 2026 ; [sitemap](../src/app/sitemap.ts), [migration de nettoyage](../supabase/migrations/20261021190000_remove_unused_sitemap_rpcs.sql) |

La migration de nettoyage SQL doit être incrémentale : l'audit initial [#71](https://github.com/Hitekk47/MetaCarScore/pull/71)
a été annulé par [#72](https://github.com/Hitekk47/MetaCarScore/pull/72), puis repris
par les commits `979c09a` et `4c292ed`. Ne pas réutiliser l'audit annulé comme état
courant de la base.

`package-lock.json` est le verrou maintenu. Les suppressions successives de `bun.lock`
(commits `1028071` et `388556f`) confortent cette convention ; elles ne constituent
pas une interdiction de changer un jour d'outillage. Bun reste le moteur de tests.

La mémoire Git commune et son protocole de maintenance dans [AGENTS.md](../AGENTS.md)
sont demandés explicitement par le mainteneur dans la mission de migration. Leur
adoption ne vaut pas résolution des questions métier ouvertes, ni autorisation de
fusion automatique.
