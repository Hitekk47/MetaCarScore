-- TEC-002B: bound the caller-controlled LIMIT in every publicly executable
-- ranking RPC, including legacy versions which remain granted to anon/authenticated.
-- Application uses: GenericTopRankingClient = 100; homepage carousel = 15.
--
-- Policy: omitted/NULL -> the existing default; <= 0 -> no rows;
-- positive values -> capped at 100 rankings or 15 trending models.
-- Bounds apply inside SQL, independently of PostgREST's response row limit.
-- These limits bound returned/materialized groups, not the input rows scanned,
-- normalized or aggregated before ORDER BY/LIMIT. They do not rate-limit requests
-- or replace infrastructure statement timeouts.
--
-- Only the LIMIT expression changes below. CREATE OR REPLACE retains each RPC's
-- signature, defaults, owner and ACL, as well as its existing security mode,
-- search_path, alias consolidation, MY filters and score/reliability semantics.

BEGIN;


-- get_model_ranking_v3: original definition in 20260827171821_remote_schema.sql.
CREATE OR REPLACE FUNCTION "public"."get_model_ranking_v3"("min_my" integer DEFAULT NULL::integer, "category_filter" "text" DEFAULT NULL::"text", "transmission_filter" "text" DEFAULT NULL::"text", "macro_category_filter" "text" DEFAULT NULL::"text", "segment_filter" "text" DEFAULT NULL::"text", "limit_val" integer DEFAULT 100) RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint, "segment_size" "text", "macro_category" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$begin
    return query
    select
        r."Marque",
        r."Famille",
        r."MY"::int,
        r."Modele",
        ROUND(AVG(r."Score"), 1) as avg_score,
        COUNT(*) as review_count,
        s."Segment_Size" as segment_size,
        s."Macro_Category" as macro_category -- On récupère aussi la macro
    from reviews r
    LEFT JOIN model_segments s ON (
        r."Marque" = s."Marque" AND
        r."Modele" = s."Modele" AND
        r."MY" = s."MY"
    )
    where
        -- 1. Filtre MY
        (min_my is null OR r."MY" >= min_my)

        -- 2. Filtre Catégorie (Moteur)
        AND (category_filter is null OR r."Type" ILIKE category_filter || '%')

        -- 3. Filtre Transmission
        AND (transmission_filter is null OR r."Transmission" ILIKE '%' || transmission_filter)

        -- 4. NOUVEAU : FILTRE MACRO CATÉGORIE
        AND (macro_category_filter is null OR s."Macro_Category" = macro_category_filter)

        -- 5. FILTRE SEGMENT
        AND (segment_filter is null OR s."Segment_Size" = segment_filter)
    group by
        r."Marque", r."Famille", r."MY", r."Modele", s."Segment_Size", s."Macro_Category"
    having
        COUNT(*) >= 3
    order by
        avg_score DESC,
        review_count DESC
    LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
end;$$;


-- get_model_ranking_v4: original definition in 20260829000000_phase4_rebadging_analytics.sql.
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
    ROUND(AVG(nr."Score"), 1) AS avg_score,
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
    COUNT(*) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_model_ranking_v5: original definition in 20260903000000_pluralism_reliability_rule.sql.
CREATE OR REPLACE FUNCTION "public"."get_model_ranking_v5"(
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
    ROUND(AVG(nr."Score"), 1) AS avg_score,
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
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_model_ranking_v6: original definition in 20260904000000_unrounded_score_averages.sql.
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
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_break_ranking: original definition in 20260827171821_remote_schema.sql.
CREATE OR REPLACE FUNCTION "public"."get_break_ranking"("min_my" integer DEFAULT NULL::integer, "limit_val" integer DEFAULT 100) RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$begin
  return query
  select
    r."Marque",
    r."Famille",
    r."MY"::int,
    r."Modele",
    ROUND(AVG(r."Score"), 1) as avg_score,
    COUNT(*) as review_count
  from reviews r
  where
    -- 1. Filtre MY
    (min_my is null OR r."MY" >= min_my)
    AND r."Modele" NOT ILIKE '%bZ4X%'
    -- 2. FILTRE "BREAK" AVANCÉ
    AND (

      r."Modele" ILIKE '% SW%' OR          -- Exclut "Swace"
      r."Modele" ILIKE '% Turismo%' OR     -- Exclut "GranTurismo"

      (r."Modele" ILIKE '% Touring%' AND r."Marque" != 'Porsche') OR

      -- C. TERMES SANS RISQUE MAJEUR (Pas d'espace forcé)
      r."Modele" ILIKE '% Shooting%' OR
      r."Modele" ILIKE '% Avant%' OR
      r."Modele" ILIKE '% Combi%' OR
      r."Modele" ILIKE '% Estate%' OR
      r."Modele" ILIKE '% Break%' OR
      r."Modele" ILIKE '% Wagon%' OR
      r."Modele" ILIKE '% Sportbrake%' OR
      r."Modele" ILIKE '% Variant%' OR
      r."Modele" ILIKE '%Outback%' OR
      r."Modele" ILIKE '%Clubman%' OR
      r."Modele" ILIKE '%ProCeed%' OR
      r."Modele" ILIKE '% All-Terrain%' OR
      r."Modele" ILIKE '%Sportstourer%' OR
      (r."Modele" ILIKE '% Tourer%' AND r."Marque" != 'BMW') OR
      r."Modele" ILIKE '%Sport Tourer%' OR

      -- E. INCLUSIONS EXACTES / EXPLICITES
      r."Modele" IN ('V60', 'V90' , 'Swace', '7 GT') OR
      (r."Modele" = '5' AND r."Marque" = 'MG') OR
      (r."Modele" = '7GT' AND r."Marque" = 'Zeekr')

    )

  group by
    r."Marque", r."Famille", r."MY", r."Modele"
  having
    COUNT(*) >= 3
  order by
    avg_score DESC,
    review_count DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
end;$$;


-- get_break_ranking_v2: original definition in 20260829000000_phase4_rebadging_analytics.sql.
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
    ROUND(AVG(nr."Score"), 1) AS avg_score,
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
    COUNT(*) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_break_ranking_v3: original definition in 20260903000000_pluralism_reliability_rule.sql.
CREATE OR REPLACE FUNCTION "public"."get_break_ranking_v3"(
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
    ROUND(AVG(nr."Score"), 1) AS avg_score,
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
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_break_ranking_v4: original definition in 20260904000000_unrounded_score_averages.sql.
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
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_convertible_ranking: original definition in 20260827171821_remote_schema.sql.
CREATE OR REPLACE FUNCTION "public"."get_convertible_ranking"("min_my" integer DEFAULT NULL::integer, "limit_val" integer DEFAULT 100) RETURNS TABLE("Marque" "text", "Famille" "text", "MY" integer, "Modele" "text", "avg_score" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$begin
  return query
  select
    r."Marque",
    r."Famille",
    r."MY"::int,
    r."Modele",
    ROUND(AVG(r."Score"), 1) as avg_score,
    COUNT(*) as review_count
  from reviews r
  where
    -- 1. Filtre MY
    (min_my is null OR r."MY" >= min_my)

    -- 2. FILTRE "DÉCOUVRABLE" (Cabriolet, Roadster, Spider...)
    AND (
      -- Mots-clés génériques
      r."Modele" ILIKE '%Cabriolet%' OR
      r."Modele" ILIKE '%Roadster%' OR
      r."Modele" ILIKE '%Spider%' OR
      r."Modele" ILIKE '%Spyder%' OR
      r."Modele" ILIKE '%Speedster%' OR
      r."Modele" ILIKE '%S/C%' OR
      r."Modele" ILIKE '%Volante%' OR  -- Aston Martin
      r."Modele" ILIKE '%Targa%' OR    -- Porsche
      r."Modele" ILIKE '%Cielo%' OR    -- Maserati MC20
      r."Modele" ILIKE '%Boxster%' OR  -- Porsche
      r."Modele" ILIKE '%Elise%' OR

      -- Cas GTS/GTC
      r."Modele" ILIKE '%GTS%' OR      -- Ferrari
      r."Modele" ILIKE '%GTC%' OR      -- Bentley / Ferrari

      -- Modèles spécifiques exacts ou préfixés
      r."Modele" ILIKE 'SL55%' OR
      r."Modele" = 'SL63' OR
      r."Modele" = 'SL43' OR
      r."Modele" = 'MX-5' OR
      r."Modele" = 'Z4' OR
      r."Modele" = 'Cyberster'
    )

  group by
    r."Marque", r."Famille", r."MY", r."Modele"
  having
    COUNT(*) >= 3
  order by
    avg_score DESC,
    review_count DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
end;$$;


-- get_convertible_ranking_v2: original definition in 20260829000000_phase4_rebadging_analytics.sql.
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
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_convertible_ranking_v3: original definition in 20260903000000_pluralism_reliability_rule.sql.
CREATE OR REPLACE FUNCTION "public"."get_convertible_ranking_v3"(
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
    COUNT(DISTINCT TRIM(nr."Testeur")) >= 3
  ORDER BY
    avg_score DESC,
    review_count DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_convertible_ranking_v4: original definition in 20260904000000_unrounded_score_averages.sql.
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
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 100), 0), 100);
END;
$$;


-- get_trending_models: original definition in 20260827171821_remote_schema.sql.
CREATE OR REPLACE FUNCTION "public"."get_trending_models"("limit_val" integer DEFAULT 15) RETURNS TABLE("Marque" "text", "Famille" "text", "Modele" "text", "MY" integer, "AvgScore" numeric, "ReviewCount" bigint, "MinPower" integer, "MaxPower" integer, "FirstTestDate" "text", "LastTestDate" "text")
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN QUERY
  SELECT
    r."Marque",
    r."Famille",
    r."Modele",
    r."MY"::int,
    ROUND(AVG(r."Score"), 0) as "AvgScore",
    COUNT(*) as "ReviewCount",
    MIN(r."Puissance")::int as "MinPower",
    MAX(r."Puissance")::int as "MaxPower",
    MIN(r."Test_date")::text as "FirstTestDate",
    MAX(r."Test_date")::text as "LastTestDate"
  FROM reviews r
  GROUP BY r."Marque", r."Famille", r."Modele", r."MY"
  HAVING COUNT(*) >= 3 -- Règle des 3 essais
  ORDER BY MIN(r."Test_date") DESC -- On trie par l'actualité la plus fraîche
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 15), 0), 15);
END;$$;


-- get_trending_models_v2: original definition in 20260829000000_phase4_rebadging_analytics.sql.
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
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 15), 0), 15);
END;
$$;


-- get_trending_models_v3: original definition in 20260903000000_pluralism_reliability_rule.sql.
CREATE OR REPLACE FUNCTION "public"."get_trending_models_v3"(
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
      ) AS c_modele
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
  HAVING COUNT(DISTINCT TRIM(nr."Testeur")) >= 3
  ORDER BY MIN(nr."Test_date") DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_val, 15), 0), 15);
END;
$$;


COMMIT;
