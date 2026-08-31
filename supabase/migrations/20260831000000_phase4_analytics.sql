-- ====================================================================
-- 1. get_vehicle_seo_stats_v2: Stats SEO complètes pour generateSeoText
-- ====================================================================
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
  -- 1. Statistiques de l'entité cible (incluant avis sous les alias)
  WITH matching_targets AS (
    SELECT p_marque AS marque, p_famille AS famille, p_modele AS modele, p_my AS my
    UNION
    SELECT alias_marque, alias_famille, alias_modele, COALESCE(canonical_my, p_my)
    FROM public.model_aliases
    WHERE canonical_marque = p_marque
      AND canonical_famille = p_famille
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
      AND (canonical_modele IS NULL OR p_modele IS NULL OR canonical_modele = p_modele)
    UNION
    SELECT canonical_marque, canonical_famille, canonical_modele, canonical_my
    FROM public.model_aliases
    WHERE alias_marque = p_marque
      AND alias_famille = p_famille
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
      AND (alias_modele IS NULL OR p_modele IS NULL OR alias_modele = p_modele)
  ),
  entity_revs AS (
    SELECT r."Score"
    FROM public.reviews r
    JOIN matching_targets mt
      ON r."Marque" = mt.marque
      AND r."Famille" = mt.famille
      AND (mt.my IS NULL OR r."MY" = mt.my)
      AND (mt.modele IS NULL OR r."Modele" = mt.modele)
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
  WITH matching_targets AS (
    SELECT p_marque AS marque, p_famille AS famille, p_modele AS modele, p_my AS my
    UNION
    SELECT alias_marque, alias_famille, alias_modele, COALESCE(canonical_my, p_my)
    FROM public.model_aliases
    WHERE canonical_marque = p_marque
      AND canonical_famille = p_famille
      AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
      AND (canonical_modele IS NULL OR p_modele IS NULL OR canonical_modele = p_modele)
  )
  SELECT jsonb_agg(
    DISTINCT jsonb_build_object(
      'macro', ms."Macro_Category",
      'size', ms."Segment_Size"
    )
  )
  INTO v_segments
  FROM public.reviews r
  JOIN matching_targets mt
    ON r."Marque" = mt.marque
    AND r."Famille" = mt.famille
    AND (mt.my IS NULL OR r."MY" = mt.my)
    AND (mt.modele IS NULL OR r."Modele" = mt.modele)
  JOIN public.model_segments ms
    ON r."Marque" = ms."Marque"
    AND r."Modele" = ms."Modele"
    AND r."MY" = ms."MY";

  -- 3. Rang et moyenne sur les cinq dernières MY
  IF v_segments IS NOT NULL AND jsonb_array_length(v_segments) > 0 THEN
    WITH target_segments AS (
      SELECT macro, size
      FROM jsonb_to_recordset(v_segments) AS es(macro text, size text)
    ),
    matching_targets AS (
      SELECT p_marque AS marque, p_famille AS famille, p_modele AS modele, p_my AS my
      UNION
      SELECT alias_marque, alias_famille, alias_modele, COALESCE(canonical_my, p_my)
      FROM public.model_aliases
      WHERE canonical_marque = p_marque
        AND canonical_famille = p_famille
        AND (canonical_my IS NULL OR p_my IS NULL OR canonical_my = p_my)
        AND (canonical_modele IS NULL OR p_modele IS NULL OR canonical_modele = p_modele)
    ),
    segment_vehicles AS (
      SELECT
        COALESCE(ma.canonical_marque, r."Marque") AS eff_marque,
        COALESCE(ma.canonical_famille, r."Famille") AS eff_famille,
        r."MY" AS eff_my,
        COALESCE(ma.canonical_modele, r."Modele") AS eff_modele,
        avg(r."Score") AS vehicle_avg_raw,
        ROUND(avg(r."Score"), 1) AS vehicle_avg_rank_score,
        count(*) AS vehicle_review_count
      FROM public.reviews r
      LEFT JOIN public.model_aliases ma ON r."Marque" = ma.alias_marque AND r."Famille" = ma.alias_famille AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      JOIN public.model_segments ms
        ON r."Marque" = ms."Marque"
        AND r."Modele" = ms."Modele"
        AND r."MY" = ms."MY"
      JOIN target_segments ts
        ON ms."Macro_Category" = ts.macro
        AND ms."Segment_Size" = ts.size
      WHERE r."MY" >= v_current_year - 5
        AND NOT EXISTS (
          SELECT 1 FROM matching_targets mt
          WHERE r."Marque" = mt.marque
            AND r."Famille" = mt.famille
            AND (mt.my IS NULL OR r."MY" = mt.my)
            AND (mt.modele IS NULL OR r."Modele" = mt.modele)
        )
      GROUP BY
        COALESCE(ma.canonical_marque, r."Marque"),
        COALESCE(ma.canonical_famille, r."Famille"),
        r."MY",
        COALESCE(ma.canonical_modele, r."Modele")
    ),
    all_for_avg AS (
      SELECT vehicle_avg_raw FROM segment_vehicles
      UNION ALL
      SELECT v_entity_avg_score
    ),
    ranked_pool AS (
      SELECT
        vehicle_avg_rank_score AS rank_score,
        vehicle_review_count AS review_count,
        false AS is_target
      FROM segment_vehicles
      WHERE vehicle_review_count >= 3
      UNION ALL
      SELECT
        v_entity_rank_score AS rank_score,
        v_entity_reviews_count AS review_count,
        true AS is_target
      WHERE v_is_reliable
    ),
    ranked_results AS (
      SELECT
        is_target,
        RANK() OVER (
          ORDER BY rank_score DESC, review_count DESC
        ) AS calculated_rank
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

  -- 4. JSON conforme à l'interface TypeScript SeoStats
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

REVOKE ALL ON FUNCTION "public"."get_vehicle_seo_stats_v2"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_vehicle_seo_stats_v2"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") TO "anon", "authenticated", "service_role";


-- ====================================================================
-- 2. get_model_ranking_v4: Classement par segment consolidé
-- ====================================================================
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
      AND (category_filter IS NULL OR r."Type" ILIKE category_filter || '%')
      AND (transmission_filter IS NULL OR r."Transmission" ILIKE '%' || transmission_filter)
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
  LEFT JOIN model_segments ms ON ms."Marque" = ma.m_marque AND ms."Modele" = ma.m_modele AND ms."MY" = ma.m_my
  WHERE (macro_category_filter IS NULL OR ms."Macro_Category" = macro_category_filter)
    AND (segment_filter IS NULL OR ms."Segment_Size" = segment_filter)
  ORDER BY ma.calculated_avg DESC, ma.total_reviews DESC
  LIMIT limit_val;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_model_ranking_v4"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_model_ranking_v4"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) TO "anon", "authenticated", "service_role";


-- ====================================================================
-- 3. get_trending_models_v2: Tendances consolidées
-- ====================================================================
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

REVOKE ALL ON FUNCTION "public"."get_trending_models_v2"("limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_trending_models_v2"("limit_val" integer) TO "anon", "authenticated", "service_role";


-- ====================================================================
-- 4. get_families_by_brand_v2: Page Marque (Gestion du même constructeur)
-- ====================================================================
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
      AND (ma.canonical_my IS NULL OR ma.canonical_my = r."MY")
  )
  -- 1. Familles canoniques de la marque demandée (avec total des avis fusionnés)
  SELECT
    br.effective_famille AS famille,
    COUNT(*) AS review_count,
    false AS is_alias,
    br.effective_marque AS canonical_marque,
    br.effective_famille AS canonical_famille
  FROM BrandReviews br
  WHERE br.effective_marque ILIKE brand_name
  GROUP BY br.effective_famille, br.effective_marque

  UNION ALL

  -- 2. Familles d'alias UNIQUEMENT si la marque d'alias est différente de la marque canonique (ex: Ebro vs Chery)
  SELECT
    r."Famille" AS famille,
    COUNT(*) AS review_count,
    true AS is_alias,
    ma.canonical_marque AS canonical_marque,
    ma.canonical_famille AS canonical_famille
  FROM reviews r
  JOIN model_aliases ma ON r."Marque" = ma.alias_marque AND r."Famille" = ma.alias_famille
  WHERE r."Marque" ILIKE brand_name
    AND ma.canonical_marque NOT ILIKE brand_name -- 👈 RÈGLE JAECOO : On n'affiche pas de doublon si même marque !
  GROUP BY r."Famille", ma.canonical_marque, ma.canonical_famille

  ORDER BY review_count DESC;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_families_by_brand_v2"("brand_name" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_families_by_brand_v2"("brand_name" "text") TO "anon", "authenticated", "service_role";


-- ====================================================================
-- 5. get_brand_ranking_v4: Classement des Marques
-- ====================================================================
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

REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v4"("min_my" integer, "min_count" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v4"("min_my" integer, "min_count" integer) TO "anon", "authenticated", "service_role";


-- ====================================================================
-- 6. get_break_ranking_v2 & get_convertible_ranking_v2
-- ====================================================================
CREATE OR REPLACE FUNCTION "public"."get_break_ranking_v2"("min_my" integer DEFAULT NULL::integer, "limit_val" integer DEFAULT 100)
RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  SELECT r."Marque", r."Famille", r."MY", r."Modele", r.avg_score, r.review_count
  FROM get_model_ranking_v4(min_my, 'Break', NULL, NULL, NULL, limit_val) r;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_break_ranking_v2"("min_my" integer, "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_break_ranking_v2"("min_my" integer, "limit_val" integer) TO "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."get_convertible_ranking_v2"("min_my" integer DEFAULT NULL::integer, "limit_val" integer DEFAULT 100)
RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  SELECT r."Marque", r."Famille", r."MY", r."Modele", r.avg_score, r.review_count
  FROM get_model_ranking_v4(min_my, 'Découvrable', NULL, NULL, NULL, limit_val) r;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_convertible_ranking_v2"("min_my" integer, "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_convertible_ranking_v2"("min_my" integer, "limit_val" integer) TO "anon", "authenticated", "service_role";


-- ====================================================================
-- 7. get_sitemap_groups_filtered_v2: Sitemap SEO propre
-- ====================================================================
CREATE OR REPLACE FUNCTION "public"."get_sitemap_groups_filtered_v2"()
RETURNS TABLE("Marque" text, "Famille" text, "MY" integer, "Modele" text, review_count bigint) AS $$
BEGIN
  RETURN QUERY
  WITH normalized_reviews AS (
    SELECT
      COALESCE(ma.canonical_marque, r."Marque") AS norm_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS norm_famille,
      COALESCE(ma.canonical_modele, r."Modele") AS norm_modele,
      r."MY"
    FROM reviews r
    LEFT JOIN model_aliases ma
      ON r."Marque" = ma.alias_marque
      AND r."Famille" = ma.alias_famille
      AND (ma.alias_modele IS NULL OR r."Modele" = ma.alias_modele)
      AND (ma.canonical_my IS NULL OR r."MY" = ma.canonical_my)
  )
  SELECT
    nr.norm_marque AS "Marque",
    nr.norm_famille AS "Famille",
    nr."MY"::int,
    nr.norm_modele AS "Modele",
    COUNT(*) AS review_count
  FROM normalized_reviews nr
  GROUP BY nr.norm_marque, nr.norm_famille, nr."MY", nr.norm_modele
  HAVING COUNT(*) >= 3;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION "public"."get_sitemap_groups_filtered_v2"() FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_sitemap_groups_filtered_v2"() TO "anon", "authenticated", "service_role";
