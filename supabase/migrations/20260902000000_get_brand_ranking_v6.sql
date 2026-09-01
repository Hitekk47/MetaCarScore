-- Migration: 20260902000000_get_brand_ranking_v6.sql
-- Description: Consolidated brand ranking v6 with canonical routing identifiers for best/worst models to eliminate 404s and support proper alias display names

CREATE OR REPLACE FUNCTION "public"."get_brand_ranking_v6"(
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
  -- 0. PRÉ-RÉSOLUTION ULTRA RAPIDE (S'exécute uniquement sur la table model_aliases, pas sur les 20k lignes)
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
    SELECT r.id, r."Marque", r."Famille", r."Modele", r."MY", r."Score"
    FROM public.reviews r
    WHERE (min_my IS NULL OR r."MY" >= min_my)
  ),
  
  -- 1. NORMALISATION INSTANTANÉE (Jointure directe sans sous-requêtes)
  normalized_reviews AS (
    SELECT 
        r.id, r."Score", r."MY",
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
  
  -- 2. CONSOLIDATION PAR VÉHICULE (ex: Chery Tiggo 7 = 8 essais)
  consolidated_models AS (
    SELECT 
        c_marque, c_famille, c_modele, "MY",
        ROUND(AVG("Score")) AS model_avg,
        COUNT(*) AS review_count
    FROM normalized_reviews
    GROUP BY c_marque, c_famille, c_modele, "MY"
    HAVING COUNT(*) >= 3
  ),
  
  -- 3. DISTRIBUTION AUX MARQUES (Canoniques + Alias)
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

  -- 4. TOTAL CONSOLIDÉ DES ESSAIS PAR MARQUE
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
    SELECT brand_name AS "Marque", ROUND(AVG("Score"), 1) AS global_avg, COUNT(DISTINCT id) AS global_count
    FROM review_brand_mapping
    GROUP BY brand_name
    HAVING COUNT(DISTINCT id) >= min_count
  )
  
  -- 5. RENDU FINAL
  SELECT 
    gs."Marque" AS brand, gs.global_avg AS avg_score, gs.global_count AS review_count,
    be.best_name AS best_model, be.best_val::integer AS best_score, be.best_fam AS best_famille, be.best_y::integer AS best_my,
    be.best_c_marque AS best_canonical_marque, be.best_c_famille AS best_canonical_famille, be.best_c_modele AS best_canonical_modele,
    bw.worst_name AS worst_model, bw.worst_val::integer AS worst_score, bw.worst_fam AS worst_famille, bw.worst_y::integer AS worst_my,
    bw.worst_c_marque AS worst_canonical_marque, bw.worst_c_famille AS worst_canonical_famille, bw.worst_c_modele AS worst_canonical_modele
  FROM global_stats gs
  LEFT JOIN brand_extremes be ON gs."Marque" = be."Marque"
  LEFT JOIN brand_worsts bw ON gs."Marque" = bw."Marque"
  ORDER BY gs.global_avg DESC;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v6"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v6"(integer, integer) TO "anon", "authenticated", "service_role";
