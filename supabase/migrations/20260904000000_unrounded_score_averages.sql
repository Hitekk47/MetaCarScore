-- Migration: 20260904000000_unrounded_score_averages.sql
-- Description: Update SQL RPCs (get_model_ranking_v6, get_break_ranking_v4, get_convertible_ranking_v4, get_brand_ranking_v8, get_vehicle_seo_stats_v5) to return raw unrounded score averages (AVG("Score")) for sorting and ranking, allowing single-point rounding in React to avoid double-rounding ceiling drift.

-- -----------------------------------------------------------------------------
-- 1. get_vehicle_seo_stats_v5
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_vehicle_seo_stats_v5"(
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
  v_entity_distinct_sources bigint;
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
    SELECT alias_marque, alias_famille, alias_modele
    FROM public.model_aliases
    WHERE canonical_marque = p_marque
      AND canonical_famille = p_famille
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
      AND (canonical_modele IS NULL OR p_modele IS NULL OR canonical_modele = p_modele)
    UNION
    SELECT canonical_marque AS alias_marque, canonical_famille AS alias_famille, canonical_modele AS alias_modele
    FROM public.model_aliases
    WHERE alias_marque = p_marque
      AND alias_famille = p_famille
      AND (alias_modele IS NULL OR p_modele IS NULL OR alias_modele = p_modele)
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
    UNION
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
    SELECT r."Score", r."Testeur"
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
    count(DISTINCT TRIM(r_sub."Testeur")),
    avg("Score"),
    percentile_cont(0.25) WITHIN GROUP (ORDER BY "Score"),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY "Score"),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY "Score"),
    count(*) FILTER (WHERE "Score" >= 75),
    count(*) FILTER (WHERE "Score" >= 50 AND "Score" < 75),
    count(*) FILTER (WHERE "Score" < 50)
  INTO
    v_entity_reviews_count,
    v_entity_distinct_sources,
    v_entity_avg_score,
    v_q1,
    v_median,
    v_q3,
    v_dist_pos_count,
    v_dist_mix_count,
    v_dist_neg_count
  FROM entity_revs r_sub;

  IF v_entity_reviews_count = 0 OR v_entity_reviews_count IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_reliable := COALESCE(v_entity_distinct_sources, 0) >= 3;
  v_entity_rank_score := v_entity_avg_score;
  v_iqr := COALESCE(v_q3 - v_q1, 0);

  v_consensus_label := CASE
    WHEN v_iqr <= 8 THEN 'consensus'
    WHEN v_iqr <= 15 THEN 'certaines nuances'
    ELSE 'forte division'
  END;

  -- 2. Segments couverts par l'entité (y compris via alias, avec LATERAL join)
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
      'macro', ms.macro_category,
      'size', ms.segment_size
    )
  )
  INTO v_segments
  FROM public.reviews r
  LEFT JOIN public.model_aliases ma
    ON r."Marque" = ma.alias_marque
   AND r."Famille" = ma.alias_famille
   AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
  LEFT JOIN LATERAL (
    SELECT
      m_seg."Segment_Size" AS segment_size,
      m_seg."Macro_Category" AS macro_category
    FROM public.model_segments m_seg
    WHERE m_seg."Marque" = COALESCE(ma.canonical_marque, r."Marque")
      AND m_seg."Modele" = COALESCE(
        ma.canonical_modele,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille AND r_c."MY" = r."MY" LIMIT 1)
        END,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille LIMIT 1)
        END,
        r."Modele"
      )
    ORDER BY (m_seg."MY" = r."MY") DESC, m_seg."MY" DESC NULLS LAST
    LIMIT 1
  ) ms ON TRUE
  WHERE ms.macro_category IS NOT NULL
    AND (
      (r."Marque" = p_marque AND r."Famille" = p_famille AND (p_my IS NULL OR r."MY" = p_my) AND (p_modele IS NULL OR r."Modele" = p_modele))
      OR EXISTS (
        SELECT 1 FROM target_alias_rules tar
        WHERE r."Marque" = tar.alias_marque
          AND r."Famille" = tar.alias_famille
          AND (p_my IS NULL OR r."MY" = p_my)
          AND (tar.alias_modele IS NULL OR r."Modele" = tar.alias_modele)
      )
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
        r."Testeur",
        COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
        COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
        COALESCE(
          ma.canonical_modele,
          CASE WHEN ma.canonical_marque IS NOT NULL THEN
            (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille AND r_c."MY" = r."MY" LIMIT 1)
          END,
          CASE WHEN ma.canonical_marque IS NOT NULL THEN
            (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille LIMIT 1)
          END,
          r."Modele"
        ) AS c_modele,
        r."Marque" AS orig_marque,
        r."Famille" AS orig_famille,
        r."Modele" AS orig_modele
      FROM public.reviews r
      LEFT JOIN public.model_aliases ma
        ON r."Marque" = ma.alias_marque
       AND r."Famille" = ma.alias_famille
       AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      LEFT JOIN LATERAL (
        SELECT
          m_seg."Segment_Size" AS segment_size,
          m_seg."Macro_Category" AS macro_category
        FROM public.model_segments m_seg
        WHERE m_seg."Marque" = COALESCE(ma.canonical_marque, r."Marque")
          AND m_seg."Modele" = COALESCE(
            ma.canonical_modele,
            CASE WHEN ma.canonical_marque IS NOT NULL THEN
              (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille AND r_c."MY" = r."MY" LIMIT 1)
            END,
            CASE WHEN ma.canonical_marque IS NOT NULL THEN
              (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille LIMIT 1)
            END,
            r."Modele"
          )
        ORDER BY (m_seg."MY" = r."MY") DESC, m_seg."MY" DESC NULLS LAST
        LIMIT 1
      ) ms ON TRUE
      JOIN target_segments ts
        ON ms.macro_category = ts.macro
       AND ms.segment_size = ts.size
      WHERE r."MY" >= v_current_year - 5
    ),
    segment_vehicles AS (
      SELECT
        c_marque,
        c_famille,
        r_can."MY",
        c_modele,
        avg(r_can."Score") AS vehicle_avg_raw,
        avg(r_can."Score") AS vehicle_avg_rank_score,
        count(*) AS vehicle_review_count,
        count(DISTINCT TRIM(r_can."Testeur")) AS vehicle_distinct_sources,
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
        vehicle_distinct_sources AS source_count,
        is_target_vehicle AS is_target
      FROM segment_vehicles
      WHERE vehicle_distinct_sources >= 3
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
    'segment_avg', v_segment_avg,
    'segments', COALESCE(v_segments, '[]'::jsonb),
    'is_reliable', v_is_reliable
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_vehicle_seo_stats_v5"("text", "text", integer, "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_vehicle_seo_stats_v5"("text", "text", integer, "text") TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 2. get_model_ranking_v6
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_model_ranking_v6"(
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
      r."Testeur",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(
        ma.canonical_modele,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c
           WHERE r_c."Marque" = ma.canonical_marque
             AND r_c."Famille" = ma.canonical_famille
             AND r_c."MY" = r."MY"
           LIMIT 1)
        END,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c
           WHERE r_c."Marque" = ma.canonical_marque
             AND r_c."Famille" = ma.canonical_famille
           LIMIT 1)
        END,
        r."Modele"
      ) AS c_modele,
      r."Marque" AS orig_marque,
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
    AVG(nr."Score") AS avg_score,
    COUNT(*) AS review_count,
    s.segment_size,
    s.macro_category
  FROM normalized_reviews nr
  LEFT JOIN LATERAL (
    SELECT
      ms."Segment_Size" AS segment_size,
      ms."Macro_Category" AS macro_category
    FROM public.model_segments ms
    WHERE ms."Marque" = nr.c_marque
      AND ms."Modele" = nr.c_modele
    ORDER BY (ms."MY" = nr."MY") DESC, ms."MY" DESC NULLS LAST
    LIMIT 1
  ) s ON TRUE
  WHERE
    (min_my IS NULL OR nr."MY" >= min_my)
    AND (category_filter IS NULL OR nr."Type" ILIKE category_filter || '%')
    AND (transmission_filter IS NULL OR nr."Transmission" ILIKE '%' || transmission_filter)
    AND (macro_category_filter IS NULL OR s.macro_category = macro_category_filter)
    AND (segment_filter IS NULL OR s.segment_size = segment_filter)
  GROUP BY
    nr.c_marque, nr.c_famille, nr."MY", nr.c_modele, s.segment_size, s.macro_category
  HAVING
    COUNT(DISTINCT TRIM(nr."Testeur")) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_model_ranking_v6"(integer, "text", "text", "text", "text", integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_model_ranking_v6"(integer, "text", "text", "text", "text", integer) TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 3. get_break_ranking_v4 & get_convertible_ranking_v4
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_break_ranking_v4"(
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
      r."Testeur",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(
        ma.canonical_modele,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille AND r_c."MY" = r."MY" LIMIT 1)
        END,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille LIMIT 1)
        END,
        r."Modele"
      ) AS c_modele,
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
    AVG(nr."Score") AS avg_score,
    COUNT(*) AS review_count
  FROM normalized_reviews nr
  WHERE
    (min_my IS NULL OR nr."MY" >= min_my)
    AND nr.orig_modele NOT ILIKE '%bZ4X%'
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
    COUNT(DISTINCT TRIM(nr."Testeur")) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_break_ranking_v4"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_break_ranking_v4"(integer, integer) TO "anon", "authenticated", "service_role";


CREATE OR REPLACE FUNCTION "public"."get_convertible_ranking_v4"(
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
      r."Testeur",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(
        ma.canonical_modele,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille AND r_c."MY" = r."MY" LIMIT 1)
        END,
        CASE WHEN ma.canonical_marque IS NOT NULL THEN
          (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille LIMIT 1)
        END,
        r."Modele"
      ) AS c_modele,
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
    AVG(nr."Score") AS avg_score,
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
    COUNT(DISTINCT TRIM(nr."Testeur")) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_convertible_ranking_v4"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_convertible_ranking_v4"(integer, integer) TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- 4. get_brand_ranking_v8
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_brand_ranking_v8"(
    "min_my" integer DEFAULT NULL::integer,
    "min_count" integer DEFAULT 5
)
RETURNS TABLE(
    "brand" "text", "avg_score" numeric, "review_count" bigint,
    "best_model" "text", "best_score" integer, "best_famille" "text", "best_my" integer,
    "best_canonical_marque" "text", "best_canonical_famille" "text", "best_canonical_modele" "text",
    "worst_model" "text", "worst_score" integer, "worst_famille" "text", "worst_my" integer,
    "worst_canonical_marque" "text", "worst_canonical_famille" "text", "worst_canonical_modele" "text"
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH
  resolved_aliases AS (
    SELECT
      ma.*,
      COALESCE(
        ma.canonical_modele,
        (SELECT r."Modele" FROM public.reviews r WHERE r."Marque" = ma.canonical_marque AND r."Famille" = ma.canonical_famille AND r."MY" = ma.canonical_my LIMIT 1),
        (SELECT r."Modele" FROM public.reviews r WHERE r."Marque" = ma.canonical_marque AND r."Famille" = ma.canonical_famille LIMIT 1)
      ) AS resolved_c_modele
    FROM public.model_aliases ma
  ),
  raw_data AS (
    SELECT r.id, r."Marque", r."Famille", r."Modele", r."MY", r."Score", r."Testeur"
    FROM public.reviews r
    WHERE (min_my IS NULL OR r."MY" >= min_my)
  ),

  normalized_reviews AS (
    SELECT
        r.id, r."Score", r."MY", r."Testeur",
        COALESCE(ra.canonical_marque, r."Marque") AS c_marque,
        COALESCE(ra.canonical_famille, r."Famille") AS c_famille,
        COALESCE(ra.resolved_c_modele, r."Modele") AS c_modele
    FROM raw_data r
    LEFT JOIN resolved_aliases ra
        ON r."Marque" = ra.alias_marque
        AND r."Famille" = ra.alias_famille
        AND (ra.alias_modele IS NULL OR r."Modele" = ra.alias_modele)
        AND (ra.canonical_my IS NULL OR r."MY" = ra.canonical_my)
  ),

  consolidated_models AS (
    SELECT
        c_marque, c_famille, c_modele, "MY",
        AVG("Score") AS model_avg,
        COUNT(*) AS review_count
    FROM normalized_reviews
    GROUP BY c_marque, c_famille, c_modele, "MY"
    HAVING COUNT(DISTINCT TRIM("Testeur")) >= 3
  ),

  model_to_brands AS (
    SELECT cm.c_marque AS brand_name, cm.c_modele AS display_model_name, cm.c_marque, cm.c_famille, cm.c_modele, cm."MY", cm.model_avg
    FROM consolidated_models cm
    UNION ALL
    SELECT DISTINCT ON (ra.alias_marque, cm.c_marque, cm.c_famille, cm.c_modele, cm."MY")
        ra.alias_marque AS brand_name,
        COALESCE(ra.alias_modele, ra.alias_famille) AS display_model_name,
        cm.c_marque, cm.c_famille, cm.c_modele, cm."MY", cm.model_avg
    FROM consolidated_models cm
    JOIN resolved_aliases ra ON cm.c_marque = ra.canonical_marque AND cm.c_famille = ra.canonical_famille
        AND (ra.canonical_my IS NULL OR cm."MY" = ra.canonical_my)
        AND (ra.canonical_modele IS NULL OR cm.c_modele = ra.resolved_c_modele)
  ),

  brand_extremes AS (
    SELECT DISTINCT ON (brand_name)
        brand_name AS "Marque", display_model_name AS best_name, c_famille AS best_fam, "MY" AS best_y,
        c_marque AS best_c_marque, c_famille AS best_c_famille, c_modele AS best_c_modele, model_avg AS best_val
    FROM model_to_brands ORDER BY brand_name, model_avg DESC
  ),
  brand_worsts AS (
    SELECT DISTINCT ON (brand_name)
        brand_name AS "Marque", display_model_name AS worst_name, c_famille AS worst_fam, "MY" AS worst_y,
        c_marque AS worst_c_marque, c_famille AS worst_c_famille, c_modele AS worst_c_modele, model_avg AS worst_val
    FROM model_to_brands ORDER BY brand_name, model_avg ASC
  ),

  review_brand_mapping AS (
    SELECT r.id, r."Score", r."Marque" AS brand_name FROM raw_data r
    UNION
    SELECT r.id, r."Score", ra.alias_marque AS brand_name
    FROM raw_data r JOIN resolved_aliases ra ON r."Marque" = ra.canonical_marque AND r."Famille" = ra.canonical_famille
    UNION
    SELECT r.id, r."Score", ra.canonical_marque AS brand_name
    FROM raw_data r JOIN resolved_aliases ra ON r."Marque" = ra.alias_marque AND r."Famille" = ra.alias_famille
  ),
  global_stats AS (
    SELECT brand_name AS "Marque", AVG("Score") AS global_avg, COUNT(DISTINCT id) AS global_count
    FROM review_brand_mapping
    GROUP BY brand_name
    HAVING COUNT(DISTINCT id) >= min_count
  )

  SELECT
    gs."Marque" AS brand, gs.global_avg AS avg_score, gs.global_count AS review_count,
    be.best_name AS best_model, ROUND(be.best_val)::integer AS best_score, be.best_fam AS best_famille, be.best_y::integer AS best_my,
    be.best_c_marque AS best_canonical_marque, be.best_c_famille AS best_canonical_famille, be.best_c_modele AS best_canonical_modele,
    bw.worst_name AS worst_model, ROUND(bw.worst_val)::integer AS worst_score, bw.worst_fam AS worst_famille, bw.worst_y::integer AS worst_my,
    bw.worst_c_marque AS worst_canonical_marque, bw.worst_c_famille AS worst_canonical_famille, bw.worst_c_modele AS worst_canonical_modele
  FROM global_stats gs
  LEFT JOIN brand_extremes be ON gs."Marque" = be."Marque"
  LEFT JOIN brand_worsts bw ON gs."Marque" = bw."Marque"
  ORDER BY gs.global_avg DESC;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v8"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v8"(integer, integer) TO "anon", "authenticated", "service_role";
