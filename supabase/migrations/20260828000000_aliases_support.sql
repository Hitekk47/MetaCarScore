-- Migration: Rebadging & Rebranding (model_aliases integration)
-- Zero downtime versioning for SQL functions

-- 1. search_cars_v14: Autocompletion with alias support and display formatting
CREATE OR REPLACE FUNCTION "public"."search_cars_v14"("search_term" "text")
RETURNS TABLE("Marque" "text", "Famille" "text", "Modele" "text", "Type" "text", "MaxMY" integer, "DisplayName" "text", "CanonicalMarque" "text", "CanonicalFamille" "text", "CanonicalModele" "text")
LANGUAGE "plpgsql"
AS $$
DECLARE
  keywords text[];
BEGIN
  -- 1. Préparation des mots-clés
  SELECT array_agg('%' || unaccent(word) || '%')
  INTO keywords
  FROM unnest(string_to_array(trim(search_term), ' ')) AS word
  WHERE length(word) > 0;

  IF keywords IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH raw_search AS (
    -- Direct reviews search (excluding vehicles that are aliased to prevent duplicate search items)
    SELECT
      r."Marque",
      r."Famille",
      r."Modele",
      r."MY",
      NULL::text AS alias_m,
      NULL::text AS alias_f,
      NULL::text AS alias_mo
    FROM reviews r
    WHERE unaccent(concat(
      CASE WHEN r."Marque" = 'VW' THEN 'VW Volkswagen'
           WHEN r."Marque" = 'Mercedes' THEN 'Mercedes Mercedes-Benz'
           ELSE r."Marque" END,
      ' ', r."Famille", ' ', r."Modele", ' ', r."MY"::text
    )) ILIKE ALL(keywords)
    AND NOT EXISTS (
      SELECT 1 FROM model_aliases ma
      WHERE ma.alias_marque = r."Marque"
        AND ma.alias_famille = r."Famille"
        AND (ma.alias_modele IS NULL OR ma.alias_modele = r."Modele")
    )

    UNION ALL

    -- Alias search (returns formatted DisplayName alongside Canonical identity)
    SELECT
      ma."canonical_marque" AS "Marque",
      ma."canonical_famille" AS "Famille",
      COALESCE(ma."canonical_modele", r."Modele") AS "Modele",
      r."MY",
      ma."alias_marque" AS alias_m,
      ma."alias_famille" AS alias_f,
      ma."alias_modele" AS alias_mo
    FROM model_aliases ma
    JOIN reviews r ON r."Marque" = ma."alias_marque" AND r."Famille" = ma."alias_famille"
      AND (ma."alias_modele" IS NULL OR r."Modele" = ma."alias_modele")
    WHERE unaccent(concat(
      CASE WHEN ma."alias_marque" = 'VW' THEN 'VW Volkswagen'
           WHEN ma."alias_marque" = 'Mercedes' THEN 'Mercedes Mercedes-Benz'
           ELSE ma."alias_marque" END,
      ' ', ma."alias_famille", ' ', COALESCE(ma."alias_modele", r."Modele"), ' ', r."MY"::text
    )) ILIKE ALL(keywords)
  )
  (
    -- FAMILLES
    SELECT
      rs."Marque",
      MAX(rs."Famille") AS "Famille",
      NULL::text AS "Modele",
      'family'::text AS "Type",
      NULL::integer AS "MaxMY",
      CASE
        WHEN MAX(rs.alias_m) IS NOT NULL THEN
          MAX(rs.alias_m) || ' ' || MAX(rs.alias_f) || ' (' || rs."Marque" || ' ' || MAX(rs."Famille") || ')'
        ELSE NULL::text
      END AS "DisplayName",
      rs."Marque" AS "CanonicalMarque",
      MAX(rs."Famille") AS "CanonicalFamille",
      NULL::text AS "CanonicalModele"
    FROM raw_search rs
    GROUP BY rs."Marque", UPPER(TRIM(rs."Famille"))
    ORDER BY count(*) DESC
    LIMIT 3
  )
  UNION ALL
  (
    -- MODÈLES
    SELECT
      rs."Marque",
      MAX(rs."Famille") AS "Famille",
      MAX(rs."Modele") AS "Modele",
      'model'::text AS "Type",
      MAX(rs."MY") AS "MaxMY",
      CASE
        WHEN MAX(rs.alias_m) IS NOT NULL THEN
          MAX(rs.alias_m) || ' ' || COALESCE(MAX(rs.alias_mo), MAX(rs.alias_f)) || ' (' || rs."Marque" || ' ' || MAX(rs."Famille") || ')'
        ELSE NULL::text
      END AS "DisplayName",
      rs."Marque" AS "CanonicalMarque",
      MAX(rs."Famille") AS "CanonicalFamille",
      MAX(rs."Modele") AS "CanonicalModele"
    FROM raw_search rs
    WHERE rs."Modele" IS NOT NULL
    GROUP BY rs."Marque", UPPER(TRIM(rs."Famille")), UPPER(TRIM(rs."Modele"))
    ORDER BY count(*) DESC
    LIMIT 7
  );
END;
$$;

ALTER FUNCTION "public"."search_cars_v14"("search_term" "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."search_cars_v14"("search_term" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."search_cars_v14"("search_term" "text") TO "anon", "authenticated", "service_role";


-- 2. get_full_context_by_slugs_v2: Resolves alias slugs to canonical identity FIRST before direct reviews lookup
CREATE OR REPLACE FUNCTION "public"."get_full_context_by_slugs_v2"(
  "p_marque_slug" "text",
  "p_famille_slug" "text" DEFAULT NULL::"text",
  "p_my" integer DEFAULT NULL::integer,
  "p_modele_slug" "text" DEFAULT NULL::"text",
  "p_powertrain_slug" "text" DEFAULT NULL::"text"
) RETURNS TABLE("real_marque" "text", "real_famille" "text", "real_modele" "text", "real_powertrain" "text", "is_alias" boolean, "alias_marque" "text", "alias_famille" "text", "alias_modele" "text")
LANGUAGE "plpgsql"
AS $$
DECLARE
  v_marque text;
  v_famille text;
  v_modele text;
  v_powertrain text;
  v_is_alias boolean := false;
  v_alias_m text;
  v_alias_f text;
  v_alias_mo text;
BEGIN
  -- Step A: Check if input slugs match an alias in model_aliases
  SELECT
    ma.canonical_marque,
    ma.canonical_famille,
    ma.canonical_modele,
    ma.alias_marque,
    ma.alias_famille,
    ma.alias_modele
  INTO
    v_marque,
    v_famille,
    v_modele,
    v_alias_m,
    v_alias_f,
    v_alias_mo
  FROM model_aliases ma
  WHERE slugify_text(ma.alias_marque) = p_marque_slug
    AND (p_famille_slug IS NULL OR slugify_text(ma.alias_famille) = p_famille_slug)
    AND (p_modele_slug IS NULL OR ma.alias_modele IS NULL OR slugify_text(ma.alias_modele) = p_modele_slug)
  LIMIT 1;

  IF v_marque IS NOT NULL THEN
    v_is_alias := true;
  END IF;

  -- Step B: If not resolved via model_aliases, perform standard direct reviews lookup
  IF v_marque IS NULL THEN
    SELECT "Marque" INTO v_marque
    FROM reviews
    WHERE slugify_text("Marque") = p_marque_slug
    LIMIT 1;

    IF v_marque IS NOT NULL AND p_famille_slug IS NOT NULL THEN
      SELECT "Famille" INTO v_famille
      FROM reviews
      WHERE "Marque" = v_marque
        AND slugify_text("Famille") = p_famille_slug
      LIMIT 1;
    END IF;

    IF v_famille IS NOT NULL AND p_my IS NOT NULL AND p_modele_slug IS NOT NULL THEN
      SELECT "Modele" INTO v_modele
      FROM reviews
      WHERE "Marque" = v_marque
        AND "Famille" = v_famille
        AND "MY" = p_my
        AND slugify_text("Modele") = p_modele_slug
      LIMIT 1;
    END IF;
  END IF;

  -- Step C: Resolve Powertrain if requested
  IF v_modele IS NOT NULL AND p_powertrain_slug IS NOT NULL THEN
    SELECT "Type" INTO v_powertrain
    FROM reviews
    WHERE ("Marque" = v_marque OR "Marque" IN (SELECT alias_marque FROM model_aliases WHERE canonical_marque = v_marque))
      AND "MY" = p_my
      AND slugify_text("Type") = p_powertrain_slug
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_marque, v_famille, v_modele, v_powertrain, v_is_alias, v_alias_m, v_alias_f, v_alias_mo;
END;
$$;

ALTER FUNCTION "public"."get_full_context_by_slugs_v2"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_full_context_by_slugs_v2"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_full_context_by_slugs_v2"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") TO "anon", "authenticated", "service_role";


-- 3. get_vehicle_seo_stats_v2: Unified SEO stats aggregating canonical & alias reviews
CREATE OR REPLACE FUNCTION "public"."get_vehicle_seo_stats_v2"("p_marque" "text", "p_famille" "text", "p_my" integer DEFAULT NULL::integer, "p_modele" "text" DEFAULT NULL::"text") RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  v_entity_reviews_count bigint;
  v_entity_avg_score numeric;
  v_entity_rank_score numeric;
  v_q1 numeric;
  v_median numeric;
  v_q3 numeric;
  v_iqr numeric;
  v_consensus_label text;
  v_dist_pos_count bigint;
  v_dist_mix_count bigint;
  v_dist_neg_count bigint;
  v_is_reliable boolean;
  v_segments jsonb;
  v_rank bigint;
  v_total_in_segment bigint;
  v_segment_avg numeric;
  v_result jsonb;
BEGIN
  -- 1. Statistiques de l'entité cible (incluant avis sous les alias)
  WITH entity_revs AS (
    SELECT r."Score"
    FROM public.reviews r
    WHERE (
      -- Match canonique
      (r."Marque" = p_marque AND r."Famille" = p_famille AND (p_my IS NULL OR r."MY" = p_my) AND (p_modele IS NULL OR r."Modele" = p_modele))
      OR
      -- Match alias
      EXISTS (
        SELECT 1 FROM public.model_aliases ma
        WHERE ma.canonical_marque = p_marque
          AND ma.canonical_famille = p_famille
          AND (ma.canonical_my IS NULL OR ma.canonical_my = r."MY")
          AND (p_my IS NULL OR r."MY" = p_my)
          AND (p_modele IS NULL OR ma.canonical_modele IS NULL OR ma.canonical_modele = p_modele)
          AND r."Marque" = ma.alias_marque
          AND r."Famille" = ma.alias_famille
          AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      )
    )
  )
  SELECT
    count(*),
    avg("Score"),
    percentile_cont(0.25) WITHIN GROUP (ORDER BY "Score"),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY "Score"),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY "Score"),
    count(*) FILTER (WHERE "Score" >= 75),
    count(*) FILTER (WHERE "Score" >= 50 AND "Score" < 75),
    count(*) FILTER (WHERE "Score" < 50)
  INTO
    v_entity_reviews_count,
    v_entity_avg_score,
    v_q1,
    v_median,
    v_q3,
    v_dist_pos_count,
    v_dist_mix_count,
    v_dist_neg_count
  FROM entity_revs;

  IF v_entity_reviews_count = 0 OR v_entity_reviews_count IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_reliable := v_entity_reviews_count >= 3;
  v_entity_rank_score := ROUND(v_entity_avg_score, 1);
  v_iqr := COALESCE(v_q3 - v_q1, 0);

  v_consensus_label := CASE
    WHEN v_iqr <= 8 THEN 'consensus'
    WHEN v_iqr <= 15 THEN 'certaines nuances'
    ELSE 'forte division'
  END;

  -- 2. Segments couverts par l'entité
  SELECT jsonb_agg(
    DISTINCT jsonb_build_object(
      'macro', ms."Macro_Category",
      'size', ms."Segment_Size"
    )
  )
  INTO v_segments
  FROM public.model_segments ms
  WHERE ms."Marque" = p_marque
    AND (
      p_modele IS NOT NULL AND ms."Modele" = p_modele
      OR
      p_modele IS NULL AND ms."Modele" IN (
        SELECT DISTINCT r."Modele"
        FROM public.reviews r
        WHERE r."Marque" = p_marque AND r."Famille" = p_famille
      )
    );

  v_result := jsonb_build_object(
    'reviewCount', v_entity_reviews_count,
    'avgScore', ROUND(v_entity_avg_score, 1),
    'isReliable', v_is_reliable,
    'iqr', ROUND(v_iqr, 1),
    'consensusLabel', v_consensus_label,
    'distribution', jsonb_build_object(
      'pos', v_dist_pos_count,
      'mix', v_dist_mix_count,
      'neg', v_dist_neg_count
    ),
    'segments', COALESCE(v_segments, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

ALTER FUNCTION "public"."get_vehicle_seo_stats_v2"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_vehicle_seo_stats_v2"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_vehicle_seo_stats_v2"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") TO "anon", "authenticated", "service_role";


-- 4. get_model_ranking_v4: Consolidated ranking mapping alias reviews to canonical identities
CREATE OR REPLACE FUNCTION "public"."get_model_ranking_v4"(
  "min_my" integer DEFAULT NULL::integer,
  "category_filter" "text" DEFAULT NULL::"text",
  "transmission_filter" "text" DEFAULT NULL::"text",
  "macro_category_filter" "text" DEFAULT NULL::"text",
  "segment_filter" "text" DEFAULT NULL::"text",
  "limit_val" integer DEFAULT 100
) RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint, "segment_size" "text", "macro_category" "text")
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH UnifiedReviews AS (
    SELECT
      COALESCE(ma.canonical_marque, r."Marque") AS effective_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS effective_famille,
      r."MY",
      COALESCE(ma.canonical_modele, r."Modele") AS effective_modele,
      r."Score",
      r."Type",
      r."Transmission"
    FROM reviews r
    LEFT JOIN model_aliases ma ON r."Marque" = ma.alias_marque
      AND r."Famille" = ma.alias_famille
      AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      AND (ma.canonical_my IS NULL OR ma.canonical_my = r."MY")
    WHERE (min_my IS NULL OR r."MY" >= min_my)
      AND (category_filter IS NULL OR r."Type" ILIKE '%' || category_filter || '%')
      AND (transmission_filter IS NULL OR r."Transmission" ILIKE '%' || transmission_filter || '%')
  ),
  ModelAggregates AS (
    SELECT
      ur.effective_marque AS m_marque,
      ur.effective_famille AS m_famille,
      ur."MY" AS m_my,
      ur.effective_modele AS m_modele,
      ROUND(AVG(ur."Score"), 1) AS calculated_avg,
      COUNT(*) AS total_reviews
    FROM UnifiedReviews ur
    GROUP BY ur.effective_marque, ur.effective_famille, ur."MY", ur.effective_modele
    HAVING COUNT(*) >= 3
  )
  SELECT
    ma.m_marque AS "Marque",
    ma.m_famille AS "Famille",
    ma.m_my AS "MY",
    ma.m_modele AS "Modele",
    ma.calculated_avg AS "avg_score",
    ma.total_reviews AS "review_count",
    ms."Segment_Size" AS "segment_size",
    ms."Macro_Category" AS "macro_category"
  FROM ModelAggregates ma
  LEFT JOIN model_segments ms ON ms."Marque" = ma.m_marque AND ms."Modele" = ma.m_modele
  WHERE (macro_category_filter IS NULL OR ms."Macro_Category" = macro_category_filter)
    AND (segment_filter IS NULL OR ms."Segment_Size" = segment_filter)
  ORDER BY ma.calculated_avg DESC, ma.total_reviews DESC
  LIMIT limit_val;
END;
$$;

ALTER FUNCTION "public"."get_model_ranking_v4"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_model_ranking_v4"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_model_ranking_v4"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) TO "anon", "authenticated", "service_role";


-- 5. get_trending_models_v2: Aggregates trending models under canonical identities
CREATE OR REPLACE FUNCTION "public"."get_trending_models_v2"("limit_val" integer DEFAULT 15)
RETURNS TABLE("Marque" "text", "Famille" "text", "Modele" "text", "MY" integer, "AvgScore" numeric, "ReviewCount" bigint, "MinPower" integer, "MaxPower" integer, "FirstTestDate" "text", "LastTestDate" "text")
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH UnifiedReviews AS (
    SELECT
      COALESCE(ma.canonical_marque, r."Marque") AS effective_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS effective_famille,
      COALESCE(ma.canonical_modele, r."Modele") AS effective_modele,
      r."MY",
      r."Score",
      r."Puissance",
      r."Test_date"
    FROM reviews r
    LEFT JOIN model_aliases ma ON r."Marque" = ma.alias_marque
      AND r."Famille" = ma.alias_famille
      AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      AND (ma.canonical_my IS NULL OR ma.canonical_my = r."MY")
  )
  SELECT
    ur.effective_marque AS "Marque",
    ur.effective_famille AS "Famille",
    ur.effective_modele AS "Modele",
    ur."MY",
    ROUND(AVG(ur."Score"), 1) AS "AvgScore",
    COUNT(*) AS "ReviewCount",
    MIN(ur."Puissance")::integer AS "MinPower",
    MAX(ur."Puissance")::integer AS "MaxPower",
    MIN(ur."Test_date")::text AS "FirstTestDate",
    MAX(ur."Test_date")::text AS "LastTestDate"
  FROM UnifiedReviews ur
  GROUP BY ur.effective_marque, ur.effective_famille, ur.effective_modele, ur."MY"
  HAVING COUNT(*) >= 3
  ORDER BY MAX(ur."Test_date") DESC, COUNT(*) DESC
  LIMIT limit_val;
END;
$$;

ALTER FUNCTION "public"."get_trending_models_v2"("limit_val" integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_trending_models_v2"("limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_trending_models_v2"("limit_val" integer) TO "anon", "authenticated", "service_role";


-- 6. get_brand_ranking_v4: Consolidated brand rankings including alias reviews
CREATE OR REPLACE FUNCTION "public"."get_brand_ranking_v4"("min_my" integer DEFAULT NULL::integer, "min_count" integer DEFAULT 5)
RETURNS TABLE("brand" "text", "avg_score" numeric, "review_count" bigint, "best_model" "text", "best_score" integer, "best_famille" "text", "best_my" integer, "worst_model" "text", "worst_score" integer, "worst_famille" "text", "worst_my" integer)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH
  UnifiedReviews AS (
    SELECT
      COALESCE(ma.canonical_marque, r."Marque") AS effective_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS effective_famille,
      COALESCE(ma.canonical_modele, r."Modele") AS effective_modele,
      r."MY",
      r."Score"
    FROM reviews r
    LEFT JOIN model_aliases ma ON r."Marque" = ma.alias_marque
      AND r."Famille" = ma.alias_famille
      AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      AND (ma.canonical_my IS NULL OR ma.canonical_my = r."MY")
    WHERE (min_my IS NULL OR r."MY" >= min_my)
  ),
  ModelStats AS (
    SELECT
      effective_marque AS "Marque", effective_modele AS "Modele", effective_famille AS "Famille", "MY",
      ROUND(AVG("Score")) as model_avg
    FROM UnifiedReviews
    GROUP BY effective_marque, effective_modele, effective_famille, "MY"
    HAVING COUNT(*) >= 3
  ),
  BrandExtremes AS (
    SELECT DISTINCT ON ("Marque") "Marque", "Modele" as best_name, "Famille" as best_fam, "MY" as best_y, model_avg as best_val
    FROM ModelStats ORDER BY "Marque", model_avg DESC
  ),
  BrandWorsts AS (
    SELECT DISTINCT ON ("Marque") "Marque", "Modele" as worst_name, "Famille" as worst_fam, "MY" as worst_y, model_avg as worst_val
    FROM ModelStats ORDER BY "Marque", model_avg ASC
  ),
  GlobalStats AS (
    SELECT
      effective_marque AS "Marque",
      ROUND(AVG("Score"), 1) as global_avg,
      COUNT(*) as global_count
    FROM UnifiedReviews
    GROUP BY effective_marque
    HAVING COUNT(*) >= min_count
  )
  SELECT
    gs."Marque",
    gs.global_avg,
    gs.global_count,
    be.best_name,
    be.best_val::int,
    be.best_fam,
    be.best_y::int,
    bw.worst_name,
    bw.worst_val::int,
    bw.worst_fam,
    bw.worst_y::int
  FROM GlobalStats gs
  LEFT JOIN BrandExtremes be ON gs."Marque" = be."Marque"
  LEFT JOIN BrandWorsts bw ON gs."Marque" = bw."Marque"
  ORDER BY gs.global_avg DESC;
END;
$$;

ALTER FUNCTION "public"."get_brand_ranking_v4"("min_my" integer, "min_count" integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v4"("min_my" integer, "min_count" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v4"("min_my" integer, "min_count" integer) TO "anon", "authenticated", "service_role";


-- 7. get_break_ranking_v2 & get_convertible_ranking_v2
CREATE OR REPLACE FUNCTION "public"."get_break_ranking_v2"("min_my" integer DEFAULT NULL::integer, "limit_val" integer DEFAULT 100)
RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_model_ranking_v4(min_my, 'Break', NULL, NULL, NULL, limit_val);
END;
$$;

ALTER FUNCTION "public"."get_break_ranking_v2"("min_my" integer, "limit_val" integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_break_ranking_v2"("min_my" integer, "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_break_ranking_v2"("min_my" integer, "limit_val" integer) TO "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."get_convertible_ranking_v2"("min_my" integer DEFAULT NULL::integer, "limit_val" integer DEFAULT 100)
RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_model_ranking_v4(min_my, 'Découvrable', NULL, NULL, NULL, limit_val);
END;
$$;

ALTER FUNCTION "public"."get_convertible_ranking_v2"("min_my" integer, "limit_val" integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_convertible_ranking_v2"("min_my" integer, "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_convertible_ranking_v2"("min_my" integer, "limit_val" integer) TO "anon", "authenticated", "service_role";


-- 8. get_families_by_brand_v2: Lists families for a brand (handling canonical vs historical alias brands)
CREATE OR REPLACE FUNCTION "public"."get_families_by_brand_v2"("brand_name" "text")
RETURNS TABLE("famille" "text", "review_count" bigint, "is_alias" boolean, "canonical_marque" "text", "canonical_famille" "text")
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH BrandReviews AS (
    SELECT
      COALESCE(ma.canonical_marque, r."Marque") AS effective_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS effective_famille
    FROM reviews r
    LEFT JOIN model_aliases ma ON r."Marque" = ma.alias_marque
      AND r."Famille" = ma.alias_famille
      AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      AND (ma.canonical_my IS NULL OR ma.canonical_my = r."MY")
  )
  SELECT
    br.effective_famille AS famille,
    COUNT(*) AS review_count,
    false AS is_alias,
    br.effective_marque AS canonical_marque,
    br.effective_famille AS canonical_famille
  FROM BrandReviews br
  WHERE br.effective_marque = brand_name
  GROUP BY br.effective_famille, br.effective_marque

  UNION ALL

  SELECT
    r."Famille" AS famille,
    COUNT(*) AS review_count,
    true AS is_alias,
    ma.canonical_marque AS canonical_marque,
    ma.canonical_famille AS canonical_famille
  FROM reviews r
  JOIN model_aliases ma ON r."Marque" = ma.alias_marque AND r."Famille" = ma.alias_famille
  WHERE r."Marque" = brand_name AND ma.canonical_marque <> brand_name
  GROUP BY r."Famille", ma.canonical_marque, ma.canonical_famille

  ORDER BY review_count DESC;
END;
$$;

ALTER FUNCTION "public"."get_families_by_brand_v2"("brand_name" "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_families_by_brand_v2"("brand_name" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_families_by_brand_v2"("brand_name" "text") TO "anon", "authenticated", "service_role";
