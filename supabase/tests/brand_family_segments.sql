-- Isolated fixtures only: scripts/test-brand-family-segments.mjs uses in-memory PostgreSQL.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL row_security TO on;
TRUNCATE public.reviews, public.model_aliases, public.model_segments;

INSERT INTO public.reviews
  ("MY", "Marque", "Famille", "Modele", "Puissance", "Type", "Transmission", "Testeur", "Test_date", "Score")
SELECT fixture.my, fixture.brand, fixture.family, fixture.model,
  150, 'Essence', 'Automatique', 'Source ' || row_number() OVER (), DATE '2026-01-01', 80
FROM (VALUES
  (2022, 'RangeFixture', 'Atlas', 'Atlas Hatch'),
  (2025, 'RangeFixture', 'Atlas', 'Atlas Cross'),
  (2026, 'RangeFixture', 'Atlas', 'Atlas GT'),
  (2026, 'RangeFixture', 'Atlas', 'Atlas GT'),
  (2024, 'RangeFixture', 'Atlas Rebadge', 'Rebadged Cross'),
  (2024, 'RangeFixture', 'Beta', 'Beta Cross'),
  (2026, 'RangeFixture', 'Gamma', 'Gamma'),
  (2025, 'RangeFixture', 'Unclassified', 'Mystery'),
  (2022, 'CheryFixture', 'Tiggo 7', 'Tiggo Original'),
  (2025, 'CheryFixture', 'Tiggo 7', 'Tiggo Plus'),
  (2026, 'EbroFixture', 'S700', 'S700'),
  (2024, 'AliasOnlyFixture', 'Commercial', 'Commercial Model')
) fixture(my, brand, family, model);

INSERT INTO public.model_aliases
  (canonical_marque, canonical_famille, canonical_modele, alias_marque, alias_famille, alias_modele)
VALUES
  ('RangeFixture', 'Atlas', 'Atlas Cross', 'RangeFixture', 'Atlas Rebadge', NULL),
  ('CheryFixture', 'Tiggo 7', NULL, 'EbroFixture', 'S700', NULL),
  ('HiddenFixture', 'Canonical', NULL, 'AliasOnlyFixture', 'Commercial', NULL);

INSERT INTO public.model_segments ("Marque", "Modele", "MY", "Macro_Category", "Segment_Size")
VALUES
  ('RangeFixture', 'Atlas Hatch', 2022, 'Berline / Hatch', 'C'),
  ('RangeFixture', 'Atlas Cross', 2025, 'SUV / Crossover', 'C'),
  ('RangeFixture', 'Atlas Cross', 2030, 'SUV / Crossover', 'D'),
  ('RangeFixture', 'Atlas GT', 2026, 'Sport / Coupé / Cab', 'GT'),
  ('RangeFixture', 'Beta Cross', 2024, 'SUV / Crossover', 'C'),
  ('RangeFixture', 'Gamma', 2020, 'SUV / Crossover', 'B'),
  ('RangeFixture', 'Gamma', 2025, 'SUV / Crossover', 'C'),
  ('CheryFixture', 'Tiggo Original', 2022, 'SUV / Crossover', 'C'),
  ('CheryFixture', 'Tiggo Plus', 2025, 'SUV / Crossover', 'D'),
  ('EbroFixture', 'S700', 2026, 'SUV / Crossover', 'B'),
  ('AliasOnlyFixture', 'Commercial Model', 2024, 'Experimental', 'UNKNOWN');

DO $$
DECLARE
  role_name text;
  brand_name text;
  old_cards jsonb;
  new_cards jsonb;
  card record;
  destination record;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    FOREACH brand_name IN ARRAY ARRAY['rangefixture', 'CheryFixture', 'EbroFixture', 'AliasOnlyFixture', 'HiddenFixture'] LOOP
      SELECT jsonb_agg(to_jsonb(c)) INTO old_cards FROM public.get_families_by_brand_v2(brand_name) c;
      SELECT jsonb_agg(to_jsonb(c) - 'latest_my' - 'segments') INTO new_cards FROM public.get_families_by_brand_v3(brand_name) c;
      IF new_cards IS DISTINCT FROM old_cards THEN
        RAISE EXCEPTION '%: v3 card identity/count/order differs from v2 for %', role_name, brand_name;
      END IF;
    END LOOP;

    SELECT * INTO STRICT card FROM public.get_families_by_brand_v3('RangeFixture') c WHERE c."Famille" = 'Atlas';
    IF card.review_count <> 5 OR card.latest_my <> 2026 OR jsonb_array_length(card.segments) <> 4 THEN
      RAISE EXCEPTION '%: Atlas must consolidate five reviews, four covered segments, latest MY 2026: %', role_name, to_jsonb(card);
    END IF;
    -- The 2024 rebadge has no exact segmentation, so the latest available map
    -- is D/2030. Its displayed MY must nevertheless remain the review MY 2024.
    IF NOT card.segments @> '[{"macro":"Berline / Hatch","size":"C","latest_my":2022}, {"macro":"SUV / Crossover","size":"C","latest_my":2025}, {"macro":"SUV / Crossover","size":"D","latest_my":2024}, {"macro":"Sport / Coupé / Cab","size":"GT","latest_my":2026}]'::jsonb THEN
      RAISE EXCEPTION '%: segment identity or per-segment MY incorrect: %', role_name, card.segments;
    END IF;
    IF EXISTS (SELECT FROM public.get_families_by_brand_v3('RangeFixture') c WHERE c."Famille" = 'Atlas Rebadge') THEN
      RAISE EXCEPTION '%: intra-brand alias must remain hidden', role_name;
    END IF;

    SELECT * INTO STRICT card FROM public.get_families_by_brand_v3('RangeFixture') c WHERE c."Famille" = 'Gamma';
    IF card.segments <> '[{"macro":"SUV / Crossover","size":"C","latest_my":2026}]'::jsonb THEN
      RAISE EXCEPTION '%: fallback must use latest segmentation but return review MY: %', role_name, card.segments;
    END IF;
    SELECT * INTO STRICT card FROM public.get_families_by_brand_v3('RangeFixture') c WHERE c."Famille" = 'Unclassified';
    IF card.latest_my <> 2025 OR card.segments <> '[]'::jsonb THEN
      RAISE EXCEPTION '%: missing segmentation must preserve the family and MY', role_name;
    END IF;

    SELECT * INTO STRICT card FROM public.get_families_by_brand_v3('EbroFixture');
    SELECT * INTO STRICT destination FROM public.get_families_by_brand_v3('CheryFixture');
    IF NOT card.is_alias OR card.canonical_marque <> 'CheryFixture' OR card.canonical_famille <> 'Tiggo 7'
      OR card.review_count <> 3 OR card.latest_my <> 2026 OR card.segments <> destination.segments
      OR NOT card.segments @> '[{"macro":"SUV / Crossover","size":"D","latest_my":2026}]'::jsonb
      OR card.segments @> '[{"macro":"SUV / Crossover","size":"B"}]'::jsonb THEN
      RAISE EXCEPTION '%: cross-brand alias must prefer canonical family/model metadata: %', role_name, to_jsonb(card);
    END IF;
    SELECT * INTO STRICT card FROM public.get_families_by_brand_v3('AliasOnlyFixture');
    IF card.segments <> '[{"macro":"Experimental","size":"UNKNOWN","latest_my":2024}]'::jsonb THEN
      RAISE EXCEPTION '%: original-model fallback must preserve unknown segments: %', role_name, to_jsonb(card);
    END IF;
    IF EXISTS (SELECT FROM public.get_families_by_brand_v3('DoesNotExist')) THEN
      RAISE EXCEPTION '%: unknown brand must return no cards', role_name;
    END IF;
    RESET ROLE;
  END LOOP;
END;
$$;
ROLLBACK;
