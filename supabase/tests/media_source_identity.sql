-- Only run in an isolated database: scripts/test-media-source-identity.mjs.
-- All data, role changes and assertions are rolled back.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL row_security TO on;
TRUNCATE public.reviews, public.model_aliases, public.model_segments;

INSERT INTO public.model_aliases
  (canonical_marque, canonical_famille, alias_marque, alias_famille)
VALUES ('IdentityFixture', 'Reliable', 'IdentityAlias', 'Rebadged');

INSERT INTO public.reviews
  ("MY", "Marque", "Famille", "Modele", "Puissance", "Type", "Transmission", "Testeur", "Test_date", "Score")
VALUES
  (2025, 'IdentityFixture', 'Reliable', 'Reliable SW Cabriolet', 150, 'Electrique', 'Automatique', ' TopGear ', '2026-01-01', 80),
  (2025, 'IdentityFixture', 'Reliable', 'Reliable SW Cabriolet', 150, 'Electrique', 'Automatique', 'topgear', '2026-01-02', 60),
  (2025, 'IdentityAlias', 'Rebadged', 'Alias SW Cabriolet', 150, 'Electrique', 'Automatique', 'TOPGEAR', '2026-01-03', 40),
  (2025, 'IdentityAlias', 'Rebadged', 'Alias SW Cabriolet', 150, 'Electrique', 'Automatique', 'AutoExpress', '2026-01-04', 100),
  (2025, 'IdentityFixture', 'Reliable', 'Reliable SW Cabriolet', 150, 'Electrique', 'Automatique', 'Third', '2026-01-05', 20),
  (2025, 'IdentityAlias', 'Rebadged', 'Alias SW Cabriolet', 150, 'Electrique', 'Automatique', '   ', '2026-01-06', 10),
  (2025, 'CaseFixture', 'Case only', 'Case SW Cabriolet', 150, 'Electrique', 'Automatique', 'TopGear', '2026-01-01', 99),
  (2025, 'CaseFixture', 'Case only', 'Case SW Cabriolet', 150, 'Electrique', 'Automatique', 'topgear', '2026-01-02', 99),
  (2025, 'CaseFixture', 'Case only', 'Case SW Cabriolet', 150, 'Electrique', 'Automatique', ' TOPGEAR ', '2026-01-03', 99),
  (2025, 'BlankFixture', 'Two sources', 'Blank SW Cabriolet', 150, 'Electrique', 'Automatique', 'TopGear', '2026-01-01', 98),
  (2025, 'BlankFixture', 'Two sources', 'Blank SW Cabriolet', 150, 'Electrique', 'Automatique', 'AutoExpress', '2026-01-02', 98),
  (2025, 'BlankFixture', 'Two sources', 'Blank SW Cabriolet', 150, 'Electrique', 'Automatique', '', '2026-01-03', 98),
  (2025, 'BlankFixture', 'Two sources', 'Blank SW Cabriolet', 150, 'Electrique', 'Automatique', E' \t\n ', '2026-01-04', 98),
  (2025, 'BlankFixture', 'Two sources', 'Blank SW Cabriolet', 150, 'Electrique', 'Automatique', U&'\00A0', '2026-01-05', 98);

INSERT INTO public.model_segments ("MY", "Marque", "Modele", "Macro_Category", "Segment_Size")
VALUES (2025, 'IdentityFixture', 'Reliable SW Cabriolet', 'SUV', 'C'),
       (2025, 'CaseFixture', 'Case SW Cabriolet', 'SUV', 'C'),
       (2025, 'BlankFixture', 'Blank SW Cabriolet', 'SUV', 'C');

DO $$
DECLARE
  role_name text;
  rpc_name text;
  item record;
  stats jsonb;
  target record;
  actual_count bigint;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    FOREACH rpc_name IN ARRAY ARRAY['get_model_ranking_v8', 'get_break_ranking_v6', 'get_convertible_ranking_v6'] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I()', rpc_name) INTO actual_count;
      IF actual_count <> 1 THEN
        RAISE EXCEPTION '% as %: variants/blanks must not qualify; got % groups', rpc_name, role_name, actual_count;
      END IF;
      EXECUTE format('SELECT * FROM public.%I()', rpc_name) INTO STRICT item;
      IF item."Marque" <> 'IdentityFixture' OR item."MY" <> 2025 OR item.review_count <> 6
         OR abs(item.avg_score - 310::numeric / 6) > 0.0000001 THEN
        RAISE EXCEPTION '% as %: preserve six reviews, raw average and canonical identity: %', rpc_name, role_name, row_to_json(item);
      END IF;
    END LOOP;

    SELECT count(*) INTO actual_count FROM public.get_trending_models_v5();
    IF actual_count <> 1 THEN RAISE EXCEPTION 'Trending as %: invalid sources qualified', role_name; END IF;
    SELECT * INTO STRICT item FROM public.get_trending_models_v5();
    IF item."Marque" <> 'IdentityFixture' OR item."ReviewCount" <> 6 OR item."AvgScore" <> 52 THEN
      RAISE EXCEPTION 'Trending as %: review count or average changed: %', role_name, row_to_json(item);
    END IF;

    SELECT count(*) INTO actual_count FROM public.get_brand_ranking_v9(min_count => 1);
    IF actual_count <> 4 THEN RAISE EXCEPTION 'Brand as %: all four brand directories must remain', role_name; END IF;
    FOR item IN SELECT * FROM public.get_brand_ranking_v9(min_count => 1) LOOP
      IF item.brand IN ('CaseFixture', 'BlankFixture') AND (item.best_model IS NOT NULL OR item.worst_model IS NOT NULL) THEN
        RAISE EXCEPTION 'Brand as %: variants/blanks cannot qualify a best/worst model: %', role_name, row_to_json(item);
      END IF;
      IF item.brand IN ('IdentityFixture', 'IdentityAlias') AND
        (item.best_model IS NULL OR item.worst_model IS NULL OR item.review_count <> 6 OR abs(item.avg_score - 310::numeric / 6) > 0.0000001) THEN
        RAISE EXCEPTION 'Brand as %: all six reviews must contribute: %', role_name, row_to_json(item);
      END IF;
    END LOOP;

    FOR target IN SELECT * FROM (VALUES
      ('IdentityFixture', 'Reliable', 'Reliable SW Cabriolet'),
      ('IdentityAlias', 'Rebadged', 'Alias SW Cabriolet')
    ) targets(marque, famille, modele) LOOP
      stats := public.get_vehicle_seo_stats_v6(target.marque, target.famille, 2025, target.modele);
      IF stats IS NULL OR (stats->>'is_reliable')::boolean IS DISTINCT FROM true OR (stats->>'review_count')::int IS DISTINCT FROM 6
         OR (stats->>'metacarscore')::int IS DISTINCT FROM 52 OR (stats->>'rank')::int IS DISTINCT FROM 1
         OR (stats->>'total_in_segment')::int IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'SEO as %: canonical/alias six-review score and eligible rank: %', role_name, stats;
      END IF;
    END LOOP;
    FOR target IN SELECT * FROM (VALUES ('CaseFixture', 'Case only', 3), ('BlankFixture', 'Two sources', 5))
      targets(marque, famille, review_count) LOOP
      stats := public.get_vehicle_seo_stats_v6(target.marque, target.famille, 2025);
      IF stats IS NULL OR (stats->>'is_reliable')::boolean IS DISTINCT FROM false OR stats->>'rank' IS NOT NULL
         OR (stats->>'review_count')::int IS DISTINCT FROM target.review_count THEN
        RAISE EXCEPTION 'SEO as %: retain reviews but no reliable score/rank for %: %', role_name, target.marque, stats;
      END IF;
    END LOOP;

    SELECT count(*) INTO actual_count FROM public.get_sitemap_groups_filtered_v4();
    IF actual_count <> 1 THEN RAISE EXCEPTION 'Model sitemap as %: expected one eligible group', role_name; END IF;
    SELECT * INTO STRICT item FROM public.get_sitemap_groups_filtered_v4();
    IF item.marque <> 'IdentityFixture' OR item.nb_essais <> 6 THEN
      RAISE EXCEPTION 'Model sitemap as %: canonical identity and six essais: %', role_name, row_to_json(item);
    END IF;
    SELECT count(*) INTO actual_count FROM public.get_sitemap_canonical_routes_v3();
    IF actual_count <> 3 THEN RAISE EXCEPTION 'Canonical sitemap as %: expected family, MY, model only', role_name; END IF;
    IF EXISTS (SELECT 1 FROM public.get_sitemap_canonical_routes_v3() WHERE marque <> 'IdentityFixture' OR nb_essais <> 6) THEN
      RAISE EXCEPTION 'Canonical sitemap as %: all levels must retain six essais', role_name;
    END IF;
    RESET ROLE;
  END LOOP;
END;
$$;
ROLLBACK;
