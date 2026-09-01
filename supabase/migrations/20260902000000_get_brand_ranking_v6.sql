-- Migration: 20260902000000_get_brand_ranking_v6.sql
-- Description: Consolidated brand ranking v6 with canonical routing identifiers for best/worst models to eliminate 404s and support proper alias display names

CREATE OR REPLACE FUNCTION "public"."get_brand_ranking_v6"(
    "min_my" integer DEFAULT NULL::integer,
    "min_count" integer DEFAULT 10
)
RETURNS TABLE(
    "brand" "text",
    "avg_score" numeric,
    "review_count" bigint,
    "best_model" "text",
    "best_score" integer,
    "best_famille" "text",
    "best_my" integer,
    "best_canonical_marque" "text",
    "best_canonical_famille" "text",
    "best_canonical_modele" "text",
    "worst_model" "text",
    "worst_score" integer,
    "worst_famille" "text",
    "worst_my" integer,
    "worst_canonical_marque" "text",
    "worst_canonical_famille" "text",
    "worst_canonical_modele" "text"
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  WITH
  raw_data AS (
    SELECT r.id, r."Marque", r."Famille", r."Modele", r."MY", r."Score"
    FROM public.reviews r
    WHERE (min_my IS NULL OR r."MY" >= min_my)
  ),

  -- 1. On consolide chaque essai sous son identité canonique
  normalized_reviews AS (
    SELECT
        r.id, r."Score", r."MY",
        COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
        COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
        COALESCE(ma.canonical_modele, r."Modele") AS c_modele
    FROM raw_data r
    LEFT JOIN public.model_aliases ma
        ON LOWER(r."Marque") = LOWER(ma.alias_marque)
        AND (ma.alias_famille IS NULL OR LOWER(r."Famille") = LOWER(ma.alias_famille))
        AND (ma.alias_modele IS NULL OR LOWER(r."Modele") = LOWER(ma.alias_modele))
        AND (ma.canonical_my IS NULL OR r."MY" = ma.canonical_my)
  ),

  -- 2. On calcule les modèles consolidés (ex: Chery Tiggo 7 = 8 essais)
  consolidated_models AS (
    SELECT
        c_marque, c_famille, c_modele, "MY",
        ROUND(AVG("Score")) AS model_avg,
        COUNT(*) AS review_count
    FROM normalized_reviews
    GROUP BY c_marque, c_famille, c_modele, "MY"
    HAVING COUNT(*) >= 1
  ),

  -- 3. On associe ces modèles consolidés à toutes les marques concernées (canoniques ET alias)
  model_to_brands AS (
    -- Marque canonique
    SELECT
        cm.c_marque AS brand_name,
        cm.c_modele AS display_model_name,
        cm.c_marque AS c_marque,
        cm.c_famille AS c_famille,
        cm.c_modele AS c_modele,
        cm."MY",
        cm.model_avg
    FROM consolidated_models cm

    UNION ALL

    -- Marque alias
    SELECT DISTINCT ON (ma.alias_marque, cm.c_marque, cm.c_famille, cm.c_modele, cm."MY")
        ma.alias_marque AS brand_name,
        COALESCE(ma.alias_modele, ma.alias_famille) AS display_model_name,
        cm.c_marque AS c_marque,
        cm.c_famille AS c_famille,
        cm.c_modele AS c_modele,
        cm."MY",
        cm.model_avg
    FROM consolidated_models cm
    JOIN public.model_aliases ma
        ON LOWER(cm.c_marque) = LOWER(ma.canonical_marque)
        AND (ma.canonical_famille IS NULL OR LOWER(cm.c_famille) = LOWER(ma.canonical_famille))
        AND (ma.canonical_my IS NULL OR cm."MY" = ma.canonical_my)
        AND (ma.canonical_modele IS NULL OR LOWER(cm.c_modele) = LOWER(ma.canonical_modele))
    ORDER BY ma.alias_marque, cm.c_marque, cm.c_famille, cm.c_modele, cm."MY"
  ),

  brand_extremes AS (
    SELECT DISTINCT ON (brand_name)
        brand_name AS "Marque",
        display_model_name AS best_name,
        c_famille AS best_fam,
        "MY" AS best_y,
        c_marque AS best_c_marque,
        c_famille AS best_c_famille,
        c_modele AS best_c_modele,
        model_avg AS best_val
    FROM model_to_brands ORDER BY brand_name, model_avg DESC
  ),
  brand_worsts AS (
    SELECT DISTINCT ON (brand_name)
        brand_name AS "Marque",
        display_model_name AS worst_name,
        c_famille AS worst_fam,
        "MY" AS worst_y,
        c_marque AS worst_c_marque,
        c_famille AS worst_c_famille,
        c_modele AS worst_c_modele,
        model_avg AS worst_val
    FROM model_to_brands ORDER BY brand_name, model_avg ASC
  ),

  -- 4. On mappe CHAQUE ESSAI à TOUTES les marques concernées pour le total consolidé
  review_brand_mapping AS (
    -- Essais bruts
    SELECT r.id, r."Score", r."Marque" AS brand_name FROM raw_data r
    UNION
    -- L'essai appartient aussi à la marque alias (ex: un essai Chery compte pour Ebro)
    SELECT r.id, r."Score", ma.alias_marque AS brand_name
    FROM raw_data r
    JOIN public.model_aliases ma ON LOWER(r."Marque") = LOWER(ma.canonical_marque)
        AND (ma.canonical_famille IS NULL OR LOWER(r."Famille") = LOWER(ma.canonical_famille))
    UNION
    -- L'essai appartient aussi à la marque canonique (ex: un essai Ebro compte pour Chery)
    SELECT r.id, r."Score", ma.canonical_marque AS brand_name
    FROM raw_data r
    JOIN public.model_aliases ma ON LOWER(r."Marque") = LOWER(ma.alias_marque)
        AND (ma.alias_famille IS NULL OR LOWER(r."Famille") = LOWER(ma.alias_famille))
  ),

  -- 5. Statistiques globales
  global_stats AS (
    SELECT
        brand_name AS "Marque",
        ROUND(AVG("Score"), 1) AS global_avg,
        COUNT(DISTINCT id) AS global_count
    FROM review_brand_mapping
    GROUP BY brand_name
    HAVING COUNT(DISTINCT id) >= min_count
  )

  SELECT
    gs."Marque" AS brand,
    gs.global_avg AS avg_score,
    gs.global_count AS review_count,
    be.best_name AS best_model,
    be.best_val::integer AS best_score,
    be.best_fam AS best_famille,
    be.best_y::integer AS best_my,
    be.best_c_marque AS best_canonical_marque,
    be.best_c_famille AS best_canonical_famille,
    be.best_c_modele AS best_canonical_modele,
    bw.worst_name AS worst_model,
    bw.worst_val::integer AS worst_score,
    bw.worst_fam AS worst_famille,
    bw.worst_y::integer AS worst_my,
    bw.worst_c_marque AS worst_canonical_marque,
    bw.worst_c_famille AS worst_canonical_famille,
    bw.worst_c_modele AS worst_canonical_modele
  FROM global_stats gs
  LEFT JOIN brand_extremes be ON gs."Marque" = be."Marque"
  LEFT JOIN brand_worsts bw ON gs."Marque" = bw."Marque"
  ORDER BY gs.global_avg DESC;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v6"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v6"(integer, integer) TO "anon", "authenticated", "service_role";
