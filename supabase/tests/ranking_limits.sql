-- Run only on an isolated test database after applying migrations.
-- The supplied scripts/test-ranking-limits.mjs runner creates an in-memory
-- PostgreSQL instance, replays migrations and executes this transaction.
-- Only the newly versioned endpoints are expected to enforce bounds. Legacy
-- endpoints remain available unchanged for a zero-downtime rollout.
-- No pgTAP extension is required. All fixtures are rolled back.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL row_security TO on;
TRUNCATE public.reviews, public.model_aliases, public.model_segments;

-- More groups than either cap, each qualifying for both body-style rankings,
-- the distinct-source reliability rule and the legacy count rule.
INSERT INTO public.reviews
  ("MY", "Marque", "Famille", "Modele", "Puissance", "Type",
   "Transmission", "Testeur", "Test_date", "Score")
SELECT 2024, 'LimitFixture', 'Family ' || model_number,
       'Model SW Cabriolet ' || model_number, 150, 'Electrique',
       'Automatique', 'Source ' || source_number,
       DATE '2026-01-01' + model_number, 80
FROM generate_series(1, 125) model_number
CROSS JOIN generate_series(1, 3) source_number;

DO $$
DECLARE
  role_name text;
  rpc record;
  test_case record;
  cap integer;
  actual_count bigint;
  rpc_count integer := 0;
BEGIN
  FOR rpc IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'get_model_ranking_v7', 'get_break_ranking_v5',
      'get_convertible_ranking_v5', 'get_trending_models_v4'
    ])
  LOOP
    rpc_count := rpc_count + 1;
    cap := CASE WHEN rpc.proname LIKE 'get_trending_models%' THEN 15 ELSE 100 END;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF NOT has_function_privilege(role_name, rpc.oid, 'EXECUTE') THEN
        RAISE EXCEPTION '% cannot execute %', role_name, rpc.proname;
      END IF;
      EXECUTE format('SET LOCAL ROLE %I', role_name);
      EXECUTE format('SELECT count(*) FROM public.%I()', rpc.proname) INTO actual_count;
      IF actual_count <> cap THEN
        RAISE EXCEPTION '% as %: omitted limit returned %, expected %',
          rpc.proname, role_name, actual_count, cap;
      END IF;
      FOR test_case IN
        SELECT * FROM (VALUES
          (NULL::integer, cap), (-2147483648, 0), (-1, 0), (0, 0),
          (1, 1), (cap - 1, cap - 1), (cap, cap),
          (cap + 1, cap), (2147483647, cap)
        ) cases(limit_value, expected_count)
      LOOP
        EXECUTE format('SELECT count(*) FROM public.%I(limit_val => $1)', rpc.proname)
          INTO actual_count USING test_case.limit_value;
        IF actual_count <> test_case.expected_count THEN
          RAISE EXCEPTION '% as %: limit % returned %, expected %',
            rpc.proname, role_name, test_case.limit_value,
            actual_count, test_case.expected_count;
        END IF;
      END LOOP;
      RESET ROLE;
    END LOOP;
  END LOOP;
  IF rpc_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 new versioned RPCs, found %', rpc_count;
  END IF;
END;
$$;

TRUNCATE public.reviews, public.model_aliases, public.model_segments;

-- A family-level alias intentionally has all three optional fields NULL.
-- Neither denomination alone meets the latest three-distinct-source rule in
-- 2024. Together they must form one ranked entity, without the 2023 reviews.
INSERT INTO public.model_aliases
  (canonical_marque, canonical_famille, canonical_modele, canonical_my,
   alias_marque, alias_famille, alias_modele)
VALUES ('Canonical', 'Unified', NULL, NULL, 'Equivalent', 'Rebadged', NULL);

INSERT INTO public.reviews
  ("MY", "Marque", "Famille", "Modele", "Puissance", "Type",
   "Transmission", "Testeur", "Test_date", "Score")
VALUES
  (2024, 'Canonical', 'Unified', 'Unified SW Cabriolet', 150, 'Electrique', 'Automatique', 'A', '2026-01-01', 70),
  (2024, 'Canonical', 'Unified', 'Unified SW Cabriolet', 150, 'Electrique', 'Automatique', 'B', '2026-01-02', 72),
  (2024, 'Equivalent', 'Rebadged', 'Equivalent SW Cabriolet', 150, 'Electrique', 'Automatique', 'C', '2026-01-03', 90),
  (2023, 'Canonical', 'Unified', 'Unified SW Cabriolet', 150, 'Electrique', 'Automatique', 'A', '2025-01-01', 10),
  (2023, 'Equivalent', 'Rebadged', 'Equivalent SW Cabriolet', 150, 'Electrique', 'Automatique', 'B', '2025-01-02', 10),
  (2023, 'Equivalent', 'Rebadged', 'Equivalent SW Cabriolet', 150, 'Electrique', 'Automatique', 'C', '2025-01-03', 10);

DO $$
DECLARE
  role_name text;
  rpc_name text;
  actual_count bigint;
  item record;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    FOREACH rpc_name IN ARRAY ARRAY[
      'get_model_ranking_v7', 'get_break_ranking_v5', 'get_convertible_ranking_v5'
    ] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I(min_my => 2024, limit_val => NULL)', rpc_name)
        INTO actual_count;
      IF actual_count <> 1 THEN
        RAISE EXCEPTION '% as %: expected one consolidated 2024 group, got %',
          rpc_name, role_name, actual_count;
      END IF;
      EXECUTE format('SELECT * FROM public.%I(min_my => 2024, limit_val => NULL)', rpc_name)
        INTO STRICT item;
      IF item."Marque" <> 'Canonical' OR item."Famille" <> 'Unified'
         OR item."Modele" <> 'Unified SW Cabriolet' OR item."MY" <> 2024
         OR item.review_count <> 3 OR abs(item.avg_score - 232::numeric / 3) > 0.0000001 THEN
        RAISE EXCEPTION '% as %: alias consolidation, MY or raw score changed: %',
          rpc_name, role_name, row_to_json(item);
      END IF;
      EXECUTE format('SELECT count(*) FROM public.%I(min_my => 2023, limit_val => NULL)', rpc_name)
        INTO actual_count;
      IF actual_count <> 2 THEN
        RAISE EXCEPTION '% as %: model years must remain separate groups', rpc_name, role_name;
      END IF;
    END LOOP;

    SELECT count(*) INTO actual_count FROM public.get_trending_models_v4(limit_val => NULL);
    IF actual_count <> 2 THEN
      RAISE EXCEPTION 'Trending as %: family aliases must produce two separate MY groups', role_name;
    END IF;
    SELECT * INTO STRICT item FROM public.get_trending_models_v4(limit_val => NULL) WHERE "MY" = 2024;
    IF item."Marque" <> 'Canonical' OR item."Modele" <> 'Unified SW Cabriolet'
       OR item."ReviewCount" <> 3 OR item."AvgScore" <> 77 THEN
      RAISE EXCEPTION 'Trending as %: alias consolidation changed: %', role_name, row_to_json(item);
    END IF;
    RESET ROLE;
  END LOOP;
END;
$$;
ROLLBACK;
