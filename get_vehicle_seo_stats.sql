-- get_vehicle_seo_stats.sql
-- Optimisation pour MetaCarScore (table ~20 000 lignes)

-- 1. Indexation pour accélérer les recherches et les agrégations
CREATE INDEX IF NOT EXISTS idx_reviews_seo_lookup ON reviews ("Marque", "Famille", "MY", "Modele", "Score");
CREATE INDEX IF NOT EXISTS idx_model_segments_lookup ON model_segments ("Marque", "Modele", "MY", "Macro_Category", "Segment_Size");

-- 2. Fonction RPC Polyvalente
CREATE OR REPLACE FUNCTION get_vehicle_seo_stats(
  p_marque text,
  p_famille text,
  p_my integer DEFAULT NULL,
  p_modele text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  v_entity_reviews_count bigint;
  v_entity_avg_score numeric;
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
  -- 1. Récupération des avis pour l'entité cible (Modèle, MY ou Famille)
  WITH entity_revs AS (
    SELECT "Score"
    FROM reviews
    WHERE "Marque" = p_marque
      AND "Famille" = p_famille
      AND (p_my IS NULL OR "MY" = p_my)
      AND (p_modele IS NULL OR "Modele" = p_modele)
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
    v_entity_reviews_count, v_entity_avg_score,
    v_q1, v_median, v_q3,
    v_dist_pos_count, v_dist_mix_count, v_dist_neg_count
  FROM entity_revs;

  -- Si aucun avis n'est trouvé, on sort
  IF v_entity_reviews_count = 0 OR v_entity_reviews_count IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_reliable := (v_entity_reviews_count >= 3);
  v_iqr := COALESCE(v_q3 - v_q1, 0);

  -- Nouveaux seuils : ≤8 (consensus), 8-15 (nuance), >15 (forte division)
  v_consensus_label := CASE
    WHEN v_iqr <= 8 THEN 'consensus'
    WHEN v_iqr <= 15 THEN 'certaines nuances'
    ELSE 'forte division'
  END;

  -- 2. Identification des segments couverts via model_segments
  SELECT jsonb_agg(DISTINCT jsonb_build_object('macro', ms."Macro_Category", 'size', ms."Segment_Size"))
  INTO v_segments
  FROM reviews r
  JOIN model_segments ms ON r."Marque" = ms."Marque" AND r."Modele" = ms."Modele" AND r."MY" = ms."MY"
  WHERE r."Marque" = p_marque
    AND r."Famille" = p_famille
    AND (p_my IS NULL OR r."MY" = p_my)
    AND (p_modele IS NULL OR r."Modele" = p_modele);

  -- 3. Calcul du rang et de la moyenne dans le segment (Benchmarking sur les 5 dernières années)
  IF v_segments IS NOT NULL AND jsonb_array_length(v_segments) > 0 THEN
    WITH target_segments AS (
      SELECT macro, size FROM jsonb_to_recordset(v_segments) as es(macro text, size text)
    ),
    segment_vehicles AS (
      SELECT
        r."Marque", r."Modele", r."MY",
        avg(r."Score") as vehicle_avg,
        count(*) as vehicle_review_count
      FROM reviews r
      JOIN model_segments ms ON r."Marque" = ms."Marque" AND r."Modele" = ms."Modele" AND r."MY" = ms."MY"
      JOIN target_segments ts ON ms."Macro_Category" = ts.macro AND ms."Segment_Size" = ts.size
      WHERE r."MY" >= (v_current_year - 5)
        AND NOT (
          r."Marque" = p_marque
          AND r."Famille" = p_famille
          AND (p_my IS NULL OR r."MY" = p_my)
          AND (p_modele IS NULL OR r."Modele" = p_modele)
        )
      GROUP BY r."Marque", r."Modele", r."MY"
    ),
    all_for_avg AS (
       SELECT vehicle_avg FROM segment_vehicles
       UNION ALL
       SELECT v_entity_avg_score
    ),
    ranked_pool AS (
       SELECT vehicle_avg FROM segment_vehicles WHERE vehicle_review_count >= 3
       UNION ALL
       SELECT v_entity_avg_score WHERE v_is_reliable
    )
    SELECT
      CASE WHEN v_is_reliable THEN (SELECT count(*) + 1 FROM ranked_pool WHERE vehicle_avg > v_entity_avg_score) ELSE NULL END,
      (SELECT count(*) FROM ranked_pool),
      (SELECT avg(vehicle_avg) FROM all_for_avg)
    INTO v_rank, v_total_in_segment, v_segment_avg;
  END IF;

  -- 4. Assemblage du résultat final
  v_result := jsonb_build_object(
    'review_count', v_entity_reviews_count,
    'metacarscore', ROUND(v_entity_avg_score),
    'q1', ROUND(v_q1::numeric, 1),
    'median', ROUND(v_median::numeric, 1),
    'q3', ROUND(v_q3::numeric, 1),
    'iqr', ROUND(v_iqr::numeric, 1),
    'consensus_label', v_consensus_label,
    'distribution', jsonb_build_object(
      'positive', jsonb_build_object('count', v_dist_pos_count, 'percentage', ROUND((v_dist_pos_count::numeric / v_entity_reviews_count) * 100)),
      'mixed', jsonb_build_object('count', v_dist_mix_count, 'percentage', ROUND((v_dist_mix_count::numeric / v_entity_reviews_count) * 100)),
      'negative', jsonb_build_object('count', v_dist_neg_count, 'percentage', ROUND((v_dist_neg_count::numeric / v_entity_reviews_count) * 100))
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
