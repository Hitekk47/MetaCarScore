-- Migration: 20260829000000_phase4_rebadging_analytics.sql
-- Description: Phase 4 Rebadging & Rebranding Analytics Unification (SEO Stats, Rankings, Trends, Brand Families, Sitemap)

-- -----------------------------------------------------------------------------
-- 1. get_vehicle_seo_stats_v2
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_vehicle_seo_stats_v2"(
  "p_marque" "text",
  "p_famille" "text",
  "p_my" integer DEFAULT NULL::integer,
  "p_modele" "text" DEFAULT NULL::"text"
) RETURNS "jsonb"
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
  -- 1. Statistiques de l'entité cible (canonique + tous alias)
  WITH target_alias_rules AS (
    -- Cas 1: p_marque/p_famille est le canonique
    SELECT alias_marque, alias_famille, alias_modele
    FROM public.model_aliases
    WHERE canonical_marque = p_marque
      AND canonical_famille = p_famille
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
      AND (canonical_modele IS NULL OR p_modele IS NULL OR canonical_modele = p_modele)

    UNION

    -- Cas 2: p_marque/p_famille est un alias -> cibler la marque/famille canonique
    SELECT canonical_marque AS alias_marque, canonical_famille AS alias_famille, canonical_modele AS alias_modele
    FROM public.model_aliases
    WHERE alias_marque = p_marque
      AND alias_famille = p_famille
      AND (alias_modele IS NULL OR p_modele IS NULL OR alias_modele = p_modele)
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)

    UNION

    -- Cas 3: p_marque/p_famille est un alias -> cibler les autres alias du même canonique
    SELECT ma2.alias_marque, ma2.alias_famille, ma2.alias_modele
    FROM public.model_aliases ma1
    JOIN public.model_aliases ma2
      ON ma1.canonical_marque = ma2.canonical_marque
     AND ma1.canonical_famille = ma2.canonical_famille
    WHERE ma1.alias_marque = p_marque
      AND ma1.alias_famille = p_famille
      AND (ma1.alias_modele IS NULL OR p_modele IS NULL OR ma1.alias_modele = p_modele)
      AND (ma1.canonical_my IS NULL OR p_my IS NULL OR ma1.canonical_my = p_my)
  ),
  entity_revs AS (
    SELECT r."Score"
    FROM public.reviews r
    WHERE
      (r."Marque" = p_marque AND r."Famille" = p_famille AND (p_my IS NULL OR r."MY" = p_my) AND (p_modele IS NULL OR r."Modele" = p_modele))
      OR EXISTS (
        SELECT 1 FROM target_alias_rules tar
        WHERE r."Marque" = tar.alias_marque
          AND r."Famille" = tar.alias_famille
          AND (p_my IS NULL OR r."MY" = p_my)
          AND (tar.alias_modele IS NULL OR r."Modele" = tar.alias_modele)
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

  -- 2. Segments couverts par l'entité (y compris via alias)
  WITH target_alias_rules AS (
    SELECT alias_marque, alias_famille, alias_modele
    FROM public.model_aliases
    WHERE canonical_marque = p_marque AND canonical_famille = p_famille
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
      AND (canonical_modele IS NULL OR p_modele IS NULL OR canonical_modele = p_modele)
    UNION
    SELECT canonical_marque, canonical_famille, canonical_modele
    FROM public.model_aliases
    WHERE alias_marque = p_marque AND alias_famille = p_famille
      AND (alias_modele IS NULL OR p_modele IS NULL OR alias_modele = p_modele)
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
    UNION
    SELECT ma2.alias_marque, ma2.alias_famille, ma2.alias_modele
    FROM public.model_aliases ma1
    JOIN public.model_aliases ma2 ON ma1.canonical_marque = ma2.canonical_marque AND ma1.canonical_famille = ma2.canonical_famille
    WHERE ma1.alias_marque = p_marque AND ma1.alias_famille = p_famille
      AND (ma1.alias_modele IS NULL OR p_modele IS NULL OR ma1.alias_modele = p_modele)
      AND (ma1.canonical_my IS NULL OR p_my IS NULL OR ma1.canonical_my = p_my)
  )
  SELECT jsonb_agg(
    DISTINCT jsonb_build_object(
      'macro', ms."Macro_Category",
      'size', ms."Segment_Size"
    )
  )
  INTO v_segments
  FROM public.reviews r
  JOIN public.model_segments ms
    ON r."Marque" = ms."Marque"
   AND r."Modele" = ms."Modele"
   AND r."MY" = ms."MY"
  WHERE (r."Marque" = p_marque AND r."Famille" = p_famille AND (p_my IS NULL OR r."MY" = p_my) AND (p_modele IS NULL OR r."Modele" = p_modele))
     OR EXISTS (
        SELECT 1 FROM target_alias_rules tar
        WHERE r."Marque" = tar.alias_marque
          AND r."Famille" = tar.alias_famille
          AND (p_my IS NULL OR r."MY" = p_my)
          AND (tar.alias_modele IS NULL OR r."Modele" = tar.alias_modele)
     );

  -- 3. Rang et moyenne sur les 5 dernières MY avec véhicules consolidés
  IF v_segments IS NOT NULL AND jsonb_array_length(v_segments) > 0 THEN
    WITH target_segments AS (
      SELECT macro, size
      FROM jsonb_to_recordset(v_segments) AS es(macro text, size text)
    ),
    reviews_with_canonical AS (
      SELECT
        r."Score",
        r."MY",
        COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
        COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
        COALESCE(ma.canonical_modele, r."Modele") AS c_modele,
        r."Marque" AS orig_marque,
        r."Famille" AS orig_famille,
        r."Modele" AS orig_modele
      FROM public.reviews r
      LEFT JOIN public.model_aliases ma
        ON r."Marque" = ma.alias_marque
       AND r."Famille" = ma.alias_famille
       AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      JOIN public.model_segments ms
        ON r."Marque" = ms."Marque"
       AND r."Modele" = ms."Modele"
       AND r."MY" = ms."MY"
      JOIN target_segments ts
        ON ms."Macro_Category" = ts.macro
       AND ms."Segment_Size" = ts.size
      WHERE r."MY" >= v_current_year - 5
    ),
    segment_vehicles AS (
      SELECT
        c_marque,
        c_famille,
        r_can."MY",
        c_modele,
        avg(r_can."Score") AS vehicle_avg_raw,
        ROUND(avg(r_can."Score"), 1) AS vehicle_avg_rank_score,
        count(*) AS vehicle_review_count,
        BOOL_OR(
          (orig_marque = p_marque AND orig_famille = p_famille AND (p_my IS NULL OR r_can."MY" = p_my) AND (p_modele IS NULL OR orig_modele = p_modele))
          OR (c_marque = p_marque AND c_famille = p_famille AND (p_my IS NULL OR r_can."MY" = p_my) AND (p_modele IS NULL OR c_modele = p_modele))
        ) AS is_target_vehicle
      FROM reviews_with_canonical r_can
      GROUP BY c_marque, c_famille, r_can."MY", c_modele
    ),
    all_for_avg AS (
      SELECT vehicle_avg_raw FROM segment_vehicles
    ),
    ranked_pool AS (
      SELECT
        vehicle_avg_rank_score AS rank_score,
        vehicle_review_count AS review_count,
        is_target_vehicle AS is_target
      FROM segment_vehicles
      WHERE vehicle_review_count >= 3
    ),
    ranked_results AS (
      SELECT
        is_target,
        RANK() OVER (ORDER BY rank_score DESC, review_count DESC) AS calculated_rank
      FROM ranked_pool
    )
    SELECT
      CASE
        WHEN v_is_reliable THEN (
          SELECT calculated_rank
          FROM ranked_results
          WHERE is_target = true
          LIMIT 1
        )
        ELSE NULL
      END,
      (SELECT count(*) FROM ranked_pool),
      (SELECT avg(vehicle_avg_raw) FROM all_for_avg)
    INTO
      v_rank,
      v_total_in_segment,
      v_segment_avg;
  END IF;

  v_result := jsonb_build_object(
    'review_count', v_entity_reviews_count,
    'metacarscore', ROUND(v_entity_avg_score),
    'q1', ROUND(v_q1::numeric, 1),
    'median', ROUND(v_median::numeric, 1),
    'q3', ROUND(v_q3::numeric, 1),
    'iqr', ROUND(v_iqr::numeric, 1),
    'consensus_label', v_consensus_label,
    'distribution', jsonb_build_object(
      'positive', jsonb_build_object(
        'count', v_dist_pos_count,
        'percentage', ROUND((v_dist_pos_count::numeric / v_entity_reviews_count) * 100)
      ),
      'mixed', jsonb_build_object(
        'count', v_dist_mix_count,
        'percentage', ROUND((v_dist_mix_count::numeric / v_entity_reviews_count) * 100)
      ),
      'negative', jsonb_build_object(
        'count', v_dist_neg_count,
        'percentage', ROUND((v_dist_neg_count::numeric / v_entity_reviews_count) * 100)
      )
    ),
    'rank', v_rank,
    'total_in_segment', v_total_in_segment,
    'segment_avg', ROUND(v_segment_avg, 1),
    'segments', COALESCE(v_segments, '[]'::jsonb),
    'is_reliable', v_is_reliable
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_vehicle_seo_stats_v2"("text", "text", integer, "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_vehicle_seo_stats_v2"("text", "text", integer, "text") TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 2. get_model_ranking_v4
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_model_ranking_v4"(
  "min_my" integer DEFAULT NULL::integer,
  "category_filter" "text" DEFAULT NULL::"text",
  "transmission_filter" "text" DEFAULT NULL::"text",
  "macro_category_filter" "text" DEFAULT NULL::"text",
  "segment_filter" "text" DEFAULT NULL::"text",
  "limit_val" integer DEFAULT 100
) RETURNS TABLE(
  "Marque" "text",
  "Famille" "text",
  "MY" integer,
  "Modele" "text",
  "avg_score" numeric,
  "review_count" bigint,
  "segment_size" "text",
  "macro_category" "text"
)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH normalized_reviews AS (
    SELECT
      r."Score",
      r."MY",
      r."Type",
      r."Transmission",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(ma.canonical_modele, r."Modele") AS c_modele,
      r."Marque" AS orig_marque,
      r."Modele" AS orig_modele
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON r."Marque" = ma.alias_marque
     AND r."Famille" = ma.alias_famille
     AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
  ),
  segment_mapping AS (
    SELECT DISTINCT ON ("Marque", "Modele", "MY")
      "Marque", "Modele", "MY", "Segment_Size", "Macro_Category"
    FROM public.model_segments
  )
  SELECT
    nr.c_marque AS "Marque",
    nr.c_famille AS "Famille",
    nr."MY"::int AS "MY",
    nr.c_modele AS "Modele",
    ROUND(AVG(nr."Score"), 1) AS avg_score,
    COUNT(*) AS review_count,
    COALESCE(MAX(s_orig."Segment_Size"), MAX(s_canon."Segment_Size")) AS segment_size,
    COALESCE(MAX(s_orig."Macro_Category"), MAX(s_canon."Macro_Category")) AS macro_category
  FROM normalized_reviews nr
  LEFT JOIN segment_mapping s_orig ON (
    nr.orig_marque = s_orig."Marque" AND nr.orig_modele = s_orig."Modele" AND nr."MY" = s_orig."MY"
  )
  LEFT JOIN segment_mapping s_canon ON (
    nr.c_marque = s_canon."Marque" AND nr.c_modele = s_canon."Modele" AND nr."MY" = s_canon."MY"
  )
  WHERE
    (min_my IS NULL OR nr."MY" >= min_my)
    AND (category_filter IS NULL OR nr."Type" ILIKE category_filter || '%')
    AND (transmission_filter IS NULL OR nr."Transmission" ILIKE '%' || transmission_filter)
    AND (macro_category_filter IS NULL OR COALESCE(s_orig."Macro_Category", s_canon."Macro_Category") = macro_category_filter)
    AND (segment_filter IS NULL OR COALESCE(s_orig."Segment_Size", s_canon."Segment_Size") = segment_filter)
  GROUP BY
    nr.c_marque, nr.c_famille, nr."MY", nr.c_modele
  HAVING
    COUNT(*) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_model_ranking_v4"(integer, "text", "text", "text", "text", integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_model_ranking_v4"(integer, "text", "text", "text", "text", integer) TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 3. get_break_ranking_v2 & get_convertible_ranking_v2
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_break_ranking_v2"(
  "min_my" integer DEFAULT NULL::integer,
  "limit_val" integer DEFAULT 100
) RETURNS TABLE(
  "Marque" "text",
  "Famille" "text",
  "MY" integer,
  "Modele" "text",
  "avg_score" numeric,
  "review_count" bigint
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH normalized_reviews AS (
    SELECT
      r."Score",
      r."MY",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(ma.canonical_modele, r."Modele") AS c_modele,
      r."Modele" AS orig_modele,
      r."Marque" AS orig_marque
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON r."Marque" = ma.alias_marque
     AND r."Famille" = ma.alias_famille
     AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
  )
  SELECT
    nr.c_marque AS "Marque",
    nr.c_famille AS "Famille",
    nr."MY"::int AS "MY",
    nr.c_modele AS "Modele",
    ROUND(AVG(nr."Score"), 1) AS avg_score,
    COUNT(*) AS review_count
  FROM normalized_reviews nr
  WHERE
    (min_my IS NULL OR nr."MY" >= min_my)
    AND (
      nr.orig_modele ILIKE '% SW%' OR
      nr.orig_modele ILIKE '% Turismo%' OR
      (nr.orig_modele ILIKE '% Touring%' AND nr.orig_marque != 'Porsche') OR
      nr.orig_modele ILIKE '% Shooting%' OR
      nr.orig_modele ILIKE '% Avant%' OR
      nr.orig_modele ILIKE '% Combi%' OR
      nr.orig_modele ILIKE '% Estate%' OR
      nr.orig_modele ILIKE '% Break%' OR
      nr.orig_modele ILIKE '% Wagon%' OR
      nr.orig_modele ILIKE '% Sportbrake%' OR
      nr.orig_modele ILIKE '% Variant%' OR
      nr.orig_modele ILIKE '%Outback%' OR
      nr.orig_modele ILIKE '%Clubman%' OR
      nr.orig_modele ILIKE '%ProCeed%' OR
      nr.orig_modele ILIKE '% All-Terrain%' OR
      nr.orig_modele ILIKE '%Sportstourer%' OR
      (nr.orig_modele ILIKE '% Tourer%' AND nr.orig_marque != 'BMW') OR
      nr.orig_modele ILIKE '%Sport Tourer%' OR
      nr.orig_modele IN ('V60', 'V90', 'Swace', '7 GT') OR
      (nr.orig_modele = '5' AND nr.orig_marque = 'MG') OR
      (nr.orig_modele = '7GT' AND nr.orig_marque = 'Zeekr')
      OR nr.c_modele ILIKE '% Break%' OR nr.c_modele ILIKE '% SW%'
    )
  GROUP BY
    nr.c_marque, nr.c_famille, nr."MY", nr.c_modele
  HAVING
    COUNT(*) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_break_ranking_v2"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_break_ranking_v2"(integer, integer) TO "anon", "authenticated", "service_role";


CREATE OR REPLACE FUNCTION "public"."get_convertible_ranking_v2"(
  "min_my" integer DEFAULT NULL::integer,
  "limit_val" integer DEFAULT 100
) RETURNS TABLE(
  "Marque" "text",
  "Famille" "text",
  "MY" integer,
  "Modele" "text",
  "avg_score" numeric,
  "review_count" bigint
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH normalized_reviews AS (
    SELECT
      r."Score",
      r."MY",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(ma.canonical_modele, r."Modele") AS c_modele,
      r."Modele" AS orig_modele
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON r."Marque" = ma.alias_marque
     AND r."Famille" = ma.alias_famille
     AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
  )
  SELECT
    nr.c_marque AS "Marque",
    nr.c_famille AS "Famille",
    nr."MY"::int AS "MY",
    nr.c_modele AS "Modele",
    ROUND(AVG(nr."Score"), 1) AS avg_score,
    COUNT(*) AS review_count
  FROM normalized_reviews nr
  WHERE
    (min_my IS NULL OR nr."MY" >= min_my)
    AND (
      nr.orig_modele ILIKE '%Cabriolet%' OR
      nr.orig_modele ILIKE '%Roadster%' OR
      nr.orig_modele ILIKE '%Spider%' OR
      nr.orig_modele ILIKE '%Spyder%' OR
      nr.orig_modele ILIKE '%Speedster%' OR
      nr.orig_modele ILIKE '%S/C%' OR
      nr.orig_modele ILIKE '%Volante%' OR
      nr.orig_modele ILIKE '%Targa%' OR
      nr.orig_modele ILIKE '%Cielo%' OR
      nr.orig_modele ILIKE '%Boxster%' OR
      nr.orig_modele ILIKE '%Elise%' OR
      nr.orig_modele ILIKE '%GTS%' OR
      nr.orig_modele ILIKE '%GTC%' OR
      nr.orig_modele ILIKE 'SL55%' OR
      nr.orig_modele = 'SL63' OR
      nr.orig_modele = 'SL43' OR
      nr.orig_modele = 'MX-5' OR
      nr.orig_modele = 'Z4' OR
      nr.orig_modele = 'Cyberster' OR
      nr.c_modele ILIKE '%Cabriolet%' OR nr.c_modele ILIKE '%Roadster%'
    )
  GROUP BY
    nr.c_marque, nr.c_famille, nr."MY", nr.c_modele
  HAVING
    COUNT(*) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_convertible_ranking_v2"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_convertible_ranking_v2"(integer, integer) TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 4. get_trending_models_v2
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_trending_models_v2"(
  "limit_val" integer DEFAULT 15
) RETURNS TABLE(
  "Marque" "text",
  "Famille" "text",
  "Modele" "text",
  "MY" integer,
  "AvgScore" numeric,
  "ReviewCount" bigint,
  "MinPower" integer,
  "MaxPower" integer,
  "FirstTestDate" "text",
  "LastTestDate" "text"
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH normalized_reviews AS (
    SELECT
      r."Score",
      r."Puissance",
      r."Test_date",
      r."MY",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(ma.canonical_modele, r."Modele") AS c_modele
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON r."Marque" = ma.alias_marque
     AND r."Famille" = ma.alias_famille
     AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
  )
  SELECT
    nr.c_marque AS "Marque",
    nr.c_famille AS "Famille",
    nr.c_modele AS "Modele",
    nr."MY"::int AS "MY",
    ROUND(AVG(nr."Score"), 0) AS "AvgScore",
    COUNT(*) AS "ReviewCount",
    MIN(nr."Puissance")::int AS "MinPower",
    MAX(nr."Puissance")::int AS "MaxPower",
    MIN(nr."Test_date")::text AS "FirstTestDate",
    MAX(nr."Test_date")::text AS "LastTestDate"
  FROM normalized_reviews nr
  GROUP BY nr.c_marque, nr.c_famille, nr.c_modele, nr."MY"
  HAVING COUNT(*) >= 3
  ORDER BY MIN(nr."Test_date") DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_trending_models_v2"(integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_trending_models_v2"(integer) TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 5. get_families_by_brand_v2
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_families_by_brand_v2"(
  "brand_name" "text"
) RETURNS TABLE(
  "famille" "text",
  "review_count" bigint,
  "is_alias" boolean,
  "canonical_marque" "text",
  "canonical_famille" "text"
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH brand_reviews AS (
    SELECT
      r."Marque",
      r."Famille",
      ma.canonical_marque,
      ma.canonical_famille,
      (ma.alias_marque IS NOT NULL AND LOWER(ma.alias_marque) = LOWER(brand_name) AND LOWER(ma.canonical_marque) = LOWER(brand_name)) AS is_intra_alias,
      (ma.alias_marque IS NOT NULL AND LOWER(ma.alias_marque) = LOWER(brand_name) AND LOWER(ma.canonical_marque) <> LOWER(brand_name)) AS is_inter_alias
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON r."Marque" = ma.alias_marque
     AND r."Famille" = ma.alias_famille
     AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
    WHERE r."Marque" ILIKE brand_name
  ),
  unified_families AS (
    SELECT
      CASE
        WHEN is_intra_alias THEN canonical_famille
        ELSE "Famille"
      END AS unified_famille,
      is_inter_alias,
      CASE WHEN is_inter_alias THEN canonical_marque ELSE NULL END AS c_m,
      CASE WHEN is_inter_alias THEN canonical_famille ELSE NULL END AS c_f
    FROM brand_reviews
  )
  SELECT
    uf.unified_famille AS famille,
    COUNT(*) AS review_count,
    BOOL_OR(uf.is_inter_alias) AS is_alias,
    MAX(uf.c_m) AS canonical_marque,
    MAX(uf.c_f) AS canonical_famille
  FROM unified_families uf
  GROUP BY uf.unified_famille
  ORDER BY review_count DESC;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_families_by_brand_v2"("text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_families_by_brand_v2"("text") TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 6. get_brand_ranking_v4
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_brand_ranking_v4"(
  "min_my" integer DEFAULT NULL::integer,
  "min_count" integer DEFAULT 5
) RETURNS TABLE(
  "brand" "text",
  "avg_score" numeric,
  "review_count" bigint,
  "best_model" "text",
  "best_score" integer,
  "best_famille" "text",
  "best_my" integer,
  "worst_model" "text",
  "worst_score" integer,
  "worst_famille" "text",
  "worst_my" integer
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH RawData AS (
    SELECT * FROM public.reviews
    WHERE (min_my IS NULL OR "MY" >= min_my)
  ),
  ModelStats AS (
    SELECT
      r."Marque",
      COALESCE(ma.canonical_modele, r."Modele") AS display_modele,
      COALESCE(ma.canonical_famille, r."Famille") AS display_famille,
      r."MY",
      ROUND(AVG(r."Score")) AS model_avg
    FROM RawData r
    LEFT JOIN public.model_aliases ma
      ON r."Marque" = ma.alias_marque
     AND r."Famille" = ma.alias_famille
     AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
    GROUP BY r."Marque", display_modele, display_famille, r."MY"
    HAVING COUNT(*) >= 3
  ),
  BrandExtremes AS (
    SELECT DISTINCT ON ("Marque") "Marque", display_modele AS best_name, display_famille AS best_fam, "MY" AS best_y, model_avg AS best_val
    FROM ModelStats ORDER BY "Marque", model_avg DESC
  ),
  BrandWorsts AS (
    SELECT DISTINCT ON ("Marque") "Marque", display_modele AS worst_name, display_famille AS worst_fam, "MY" AS worst_y, model_avg AS worst_val
    FROM ModelStats ORDER BY "Marque", model_avg ASC
  ),
  GlobalStats AS (
    SELECT
      "Marque",
      ROUND(AVG("Score"), 1) AS global_avg,
      COUNT(*) AS global_count
    FROM RawData
    GROUP BY "Marque"
    HAVING COUNT(*) >= min_count
  )
  SELECT
    gs."Marque" AS brand,
    gs.global_avg AS avg_score,
    gs.global_count AS review_count,
    be.best_name AS best_model,
    be.best_val::int AS best_score,
    be.best_fam AS best_famille,
    be.best_y::int AS best_my,
    bw.worst_name AS worst_model,
    bw.worst_val::int AS worst_score,
    bw.worst_fam AS worst_famille,
    bw.worst_y::int AS worst_my
  FROM GlobalStats gs
  LEFT JOIN BrandExtremes be ON gs."Marque" = be."Marque"
  LEFT JOIN BrandWorsts bw ON gs."Marque" = bw."Marque"
  ORDER BY gs.global_avg DESC;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v4"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v4"(integer, integer) TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 7. get_sitemap_groups_filtered_v2
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_sitemap_groups_filtered_v2"()
RETURNS TABLE(
  "marque" "text",
  "famille" "text",
  "my" "text",
  "modele" "text",
  "nb_essais" bigint
)
LANGUAGE "sql"
AS $$
  WITH normalized_reviews AS (
    SELECT
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      r."MY"::text AS c_my,
      COALESCE(ma.canonical_modele, r."Modele") AS c_modele
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON r."Marque" = ma.alias_marque
     AND r."Famille" = ma.alias_famille
     AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
  )
  SELECT
    c_marque AS "marque",
    c_famille AS "famille",
    c_my AS "my",
    c_modele AS "modele",
    COUNT(*) AS nb_essais
  FROM normalized_reviews
  GROUP BY c_marque, c_famille, c_my, c_modele
  HAVING COUNT(*) >= 3;
$$;

REVOKE ALL ON FUNCTION "public"."get_sitemap_groups_filtered_v2"() FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_sitemap_groups_filtered_v2"() TO "anon", "authenticated", "service_role";
