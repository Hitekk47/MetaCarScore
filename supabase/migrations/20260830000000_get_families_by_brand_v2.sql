-- Migration: 20260830000000_get_families_by_brand_v2.sql
-- Description: Consolidated brand family fetching with alias metadata and intra-brand deduplication

CREATE OR REPLACE FUNCTION "public"."get_families_by_brand_v2"("brand_name" "text")
RETURNS TABLE(
  "Famille" "text",
  "review_count" bigint,
  "is_alias" boolean,
  "canonical_marque" "text",
  "canonical_famille" "text"
)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH normalized_reviews AS (
    SELECT
      r."Score",
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON LOWER(r."Marque") = LOWER(ma.alias_marque)
     AND LOWER(r."Famille") = LOWER(ma.alias_famille)
     AND (ma.alias_modele IS NULL OR LOWER(r."Modele") = LOWER(ma.alias_modele))
  ),
  canonical_family_counts AS (
    SELECT
      nr.c_marque,
      nr.c_famille,
      COUNT(*) AS total_reviews
    FROM normalized_reviews nr
    GROUP BY nr.c_marque, nr.c_famille
  ),
  canonical_cards AS (
    SELECT
      cfc.c_famille AS f_name,
      cfc.total_reviews AS r_count,
      false AS alias_flag,
      NULL::text AS c_m,
      NULL::text AS c_f
    FROM canonical_family_counts cfc
    WHERE LOWER(cfc.c_marque) = LOWER(brand_name)
  ),
  alias_cards AS (
    SELECT DISTINCT ON (LOWER(ma.alias_famille))
      ma.alias_famille AS f_name,
      COALESCE(cfc.total_reviews, 0) AS r_count,
      true AS alias_flag,
      ma.canonical_marque AS c_m,
      ma.canonical_famille AS c_f
    FROM public.model_aliases ma
    JOIN canonical_family_counts cfc
      ON LOWER(ma.canonical_marque) = LOWER(cfc.c_marque)
     AND LOWER(ma.canonical_famille) = LOWER(cfc.c_famille)
    WHERE LOWER(ma.alias_marque) = LOWER(brand_name)
      AND LOWER(ma.alias_marque) <> LOWER(ma.canonical_marque)
    ORDER BY LOWER(ma.alias_famille), cfc.total_reviews DESC
  ),
  combined_cards AS (
    SELECT * FROM canonical_cards
    UNION ALL
    SELECT * FROM alias_cards
  )
  SELECT
    cc.f_name AS "Famille",
    cc.r_count AS "review_count",
    cc.alias_flag AS "is_alias",
    cc.c_m AS "canonical_marque",
    cc.c_f AS "canonical_famille"
  FROM combined_cards cc
  ORDER BY cc.r_count DESC, cc.f_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_families_by_brand_v2"("text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_families_by_brand_v2"("text") TO "anon", "authenticated", "service_role";
