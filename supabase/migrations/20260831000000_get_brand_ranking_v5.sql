-- Migration: 20260831000000_get_brand_ranking_v5.sql
-- Description: Consolidated brand ranking v5 with alias-consolidated review counts per brand

CREATE OR REPLACE FUNCTION "public"."get_brand_ranking_v5"(
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
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH raw_data AS (
    SELECT * FROM public.reviews
    WHERE (min_my IS NULL OR "MY" >= min_my)
  ),
  -- 1. Normalized reviews mapped with canonical identities via model_aliases
  normalized_reviews AS (
    SELECT
      r."Score",
      r."MY",
      r."Marque" AS orig_marque,
      r."Famille" AS orig_famille,
      r."Modele" AS orig_modele,
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
      ) AS c_modele
    FROM raw_data r
    LEFT JOIN public.model_aliases ma
      ON LOWER(r."Marque") = LOWER(ma.alias_marque)
     AND LOWER(r."Famille") = LOWER(ma.alias_famille)
     AND (ma.alias_modele IS NULL OR LOWER(r."Modele") = LOWER(ma.alias_modele))
  ),
  -- 2. Consolidated review count per brand (canonical brand OR alias brand)
  brand_consolidated_counts AS (
    SELECT
      b.brand_name AS "Marque",
      COUNT(DISTINCT nr_id.rev_id) AS total_count
    FROM (
      SELECT r_inner."Marque" AS brand_name FROM raw_data r_inner
      UNION
      SELECT ma_inner.alias_marque AS brand_name FROM public.model_aliases ma_inner
      UNION
      SELECT ma_inner.canonical_marque AS brand_name FROM public.model_aliases ma_inner
    ) b
    JOIN (
      SELECT
        r_all.ctid AS rev_id,
        r_all."Score",
        r_all."MY",
        r_all."Marque" AS orig_marque,
        r_all."Famille" AS orig_famille,
        COALESCE(ma_all.canonical_marque, r_all."Marque") AS c_marque,
        COALESCE(ma_all.canonical_famille, r_all."Famille") AS c_famille
      FROM raw_data r_all
      LEFT JOIN public.model_aliases ma_all
        ON LOWER(r_all."Marque") = LOWER(ma_all.alias_marque)
       AND LOWER(r_all."Famille") = LOWER(ma_all.alias_famille)
       AND (ma_all.alias_modele IS NULL OR LOWER(r_all."Modele") = LOWER(ma_all.alias_modele))
    ) nr_id ON LOWER(nr_id.c_marque) = LOWER(b.brand_name) OR LOWER(nr_id.orig_marque) = LOWER(b.brand_name)
    GROUP BY b.brand_name
  ),
  -- 3. Model level stats for best/worst models (using original or canonical brand)
  ModelStats AS (
    SELECT
      nr.orig_marque AS "Marque",
      nr.c_modele AS display_modele,
      nr.c_famille AS display_famille,
      nr."MY",
      ROUND(AVG(nr."Score")) AS model_avg
    FROM normalized_reviews nr
    GROUP BY nr.orig_marque, display_modele, display_famille, nr."MY"
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
      r."Marque",
      ROUND(AVG(r."Score"), 1) AS global_avg,
      bcc.total_count AS global_count
    FROM raw_data r
    JOIN brand_consolidated_counts bcc ON LOWER(bcc."Marque") = LOWER(r."Marque")
    GROUP BY r."Marque", bcc.total_count
    HAVING bcc.total_count >= min_count
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

REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v5"(integer, integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v5"(integer, integer) TO "anon", "authenticated", "service_role";
