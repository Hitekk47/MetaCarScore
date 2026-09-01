-- Migration: 20260901000000_get_vehicle_seo_stats_v3.sql
-- Description: Fix canonical model resolution in get_vehicle_seo_stats_v3 for segment determination and ranking calculation

CREATE OR REPLACE FUNCTION "public"."get_vehicle_seo_stats_v3"(
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

REVOKE ALL ON FUNCTION "public"."get_vehicle_seo_stats_v3"("text", "text", integer, "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_vehicle_seo_stats_v3"("text", "text", integer, "text") TO "anon", "authenticated", "service_role";
