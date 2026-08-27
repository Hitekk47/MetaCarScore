


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."find_brand_by_slug"("slug_input" "text") RETURNS TABLE("Marque" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r."Marque"
  FROM reviews r
  WHERE slugify_text(r."Marque") = slug_input
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_brand_by_slug"("slug_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_family_by_slug"("real_brand_name" "text", "family_slug" "text") RETURNS TABLE("Famille" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r."Famille"
  FROM reviews r
  WHERE r."Marque" = real_brand_name
  AND slugify_text(r."Famille") = family_slug
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_family_by_slug"("real_brand_name" "text", "family_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_model_by_slug"("real_brand_name" "text", "real_family_name" "text", "target_my" integer, "model_slug" "text") RETURNS TABLE("Modele" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r."Modele"
  FROM reviews r
  WHERE r."Marque" = real_brand_name
  AND r."Famille" = real_family_name
  AND r."MY" = target_my
  AND slugify_text(r."Modele") = model_slug
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_model_by_slug"("real_brand_name" "text", "real_family_name" "text", "target_my" integer, "model_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_type_by_slug"("type_slug" "text") RETURNS TABLE("Type" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r."Type"
  FROM reviews r
  WHERE slugify_text(r."Type") = type_slug
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_type_by_slug"("type_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_ranking_v3"("min_my" integer DEFAULT NULL::integer, "min_count" integer DEFAULT 5) RETURNS TABLE("brand" "text", "avg_score" numeric, "review_count" bigint, "best_model" "text", "best_score" integer, "best_famille" "text", "best_my" integer, "worst_model" "text", "worst_score" integer, "worst_famille" "text", "worst_my" integer)
    LANGUAGE "plpgsql"
    AS $$begin
  return query
  WITH 
  RawData AS (
    SELECT * FROM reviews 
    WHERE (min_my is null OR "MY" >= min_my)
  ),
  ModelStats AS (
    SELECT 
      "Marque", "Modele", "Famille", "MY",
      ROUND(AVG("Score")) as model_avg
    FROM RawData
    GROUP BY "Marque", "Modele", "Famille", "MY"
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
      "Marque",
      ROUND(AVG("Score"), 1) as global_avg,
      COUNT(*) as global_count
    FROM RawData
    GROUP BY "Marque"
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
end;$$;


ALTER FUNCTION "public"."get_brand_ranking_v3"("min_my" integer, "min_count" integer) OWNER TO "postgres";


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
  limit limit_val;
end;$$;


ALTER FUNCTION "public"."get_break_ranking"("min_my" integer, "limit_val" integer) OWNER TO "postgres";


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
  limit limit_val;
end;$$;


ALTER FUNCTION "public"."get_convertible_ranking"("min_my" integer, "limit_val" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_families_by_brand"("brand_name" "text") RETURNS TABLE("famille" "text", "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select 
    r."Famille",
    COUNT(*) as review_count
  from reviews r
  where 
    r."Marque" ILIKE brand_name
  group by r."Famille"
  order by review_count DESC;
end;
$$;


ALTER FUNCTION "public"."get_families_by_brand"("brand_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_full_context_by_slugs"("p_marque_slug" "text", "p_famille_slug" "text" DEFAULT NULL::"text", "p_my" integer DEFAULT NULL::integer, "p_modele_slug" "text" DEFAULT NULL::"text", "p_powertrain_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("real_marque" "text", "real_famille" "text", "real_modele" "text", "real_powertrain" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_marque text;
  v_famille text;
  v_modele text;
  v_powertrain text;
BEGIN
  -- 1. Résolution Marque (Toujours exécutée)
  SELECT "Marque" INTO v_marque
  FROM reviews
  WHERE slugify_text("Marque") = p_marque_slug
  LIMIT 1;

  -- 2. Résolution Famille (Si demandé et Marque trouvée)
  IF v_marque IS NOT NULL AND p_famille_slug IS NOT NULL THEN
    SELECT "Famille" INTO v_famille
    FROM reviews
    WHERE "Marque" = v_marque
      AND slugify_text("Famille") = p_famille_slug
    LIMIT 1;
  END IF;

  -- 3. Résolution Modèle (Si demandé, avec Famille et MY)
  IF v_famille IS NOT NULL AND p_my IS NOT NULL AND p_modele_slug IS NOT NULL THEN
    SELECT "Modele" INTO v_modele
    FROM reviews
    WHERE "Marque" = v_marque
      AND "Famille" = v_famille
      AND "MY" = p_my
      AND slugify_text("Modele") = p_modele_slug
    LIMIT 1;
  END IF;

  -- 4. Résolution Powertrain/Type (Si demandé et Modèle trouvé)
  IF v_modele IS NOT NULL AND p_powertrain_slug IS NOT NULL THEN
    SELECT "Type" INTO v_powertrain
    FROM reviews
    WHERE "Marque" = v_marque
      AND "Famille" = v_famille
      AND "MY" = p_my
      AND "Modele" = v_modele
      AND slugify_text("Type") = p_powertrain_slug
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_marque, v_famille, v_modele, v_powertrain;
END;
$$;


ALTER FUNCTION "public"."get_full_context_by_slugs"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_homepage_stats"() RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
  total_reviews int;
  unique_models int;
begin
  -- 1. Compte total ultra rapide
  select count(*) into total_reviews from reviews;
  
  -- 2. Compte des modèles uniques (MY + Modele)
  -- C'est ici que SQL est 1000x plus rapide que JS
  select count(distinct concat("MY", '|', "Modele")) into unique_models from reviews;
  
  -- 3. On renvoie un petit objet JSON
  return json_build_object('total_reviews', total_reviews, 'unique_models', unique_models);
end;
$$;


ALTER FUNCTION "public"."get_homepage_stats"() OWNER TO "postgres";


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
    limit limit_val;
end;$$;


ALTER FUNCTION "public"."get_model_ranking_v3"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sitemap_groups_filtered"() RETURNS TABLE("marque" "text", "famille" "text", "my" "text", "modele" "text", "nb_essais" bigint)
    LANGUAGE "sql"
    AS $$SELECT "Marque", "Famille", "MY", "Modele", COUNT(*) AS review_count
  FROM reviews
  GROUP BY "Marque", "Famille", "MY", "Modele"
  HAVING COUNT(*) >= 3;$$;


ALTER FUNCTION "public"."get_sitemap_groups_filtered"() OWNER TO "postgres";


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
  LIMIT limit_val;
END;$$;


ALTER FUNCTION "public"."get_trending_models"("limit_val" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vehicle_seo_stats"("p_marque" "text", "p_famille" "text", "p_my" integer DEFAULT NULL::integer, "p_modele" "text" DEFAULT NULL::"text") RETURNS "jsonb"
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
  -- 1. Statistiques de l'entité cible
  WITH entity_revs AS (
    SELECT "Score"
    FROM public.reviews
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

  -- Même précision que get_model_ranking_v3 pour le rang public.
  v_entity_rank_score := ROUND(v_entity_avg_score, 1);

  v_iqr := COALESCE(v_q3 - v_q1, 0);

  v_consensus_label := CASE
    WHEN v_iqr <= 8 THEN 'consensus'
    WHEN v_iqr <= 15 THEN 'certaines nuances'
    ELSE 'forte division'
  END;

  -- 2. Segments couverts par l'entité
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
  WHERE r."Marque" = p_marque
    AND r."Famille" = p_famille
    AND (p_my IS NULL OR r."MY" = p_my)
    AND (p_modele IS NULL OR r."Modele" = p_modele);

  -- 3. Rang et moyenne sur les cinq dernières MY
  IF v_segments IS NOT NULL AND jsonb_array_length(v_segments) > 0 THEN
    WITH target_segments AS (
      SELECT macro, size
      FROM jsonb_to_recordset(v_segments) AS es(macro text, size text)
    ),

    -- Même unité de classement que get_model_ranking_v3 :
    -- Marque + Famille + MY + Modèle.
    segment_vehicles AS (
      SELECT
        r."Marque",
        r."Famille",
        r."MY",
        r."Modele",
        avg(r."Score") AS vehicle_avg_raw,
        ROUND(avg(r."Score"), 1) AS vehicle_avg_rank_score,
        count(*) AS vehicle_review_count
      FROM public.reviews r
      JOIN public.model_segments ms
        ON r."Marque" = ms."Marque"
        AND r."Modele" = ms."Modele"
        AND r."MY" = ms."MY"
      JOIN target_segments ts
        ON ms."Macro_Category" = ts.macro
        AND ms."Segment_Size" = ts.size
      WHERE r."MY" >= v_current_year - 5
        AND NOT (
          r."Marque" = p_marque
          AND r."Famille" = p_famille
          AND (p_my IS NULL OR r."MY" = p_my)
          AND (p_modele IS NULL OR r."Modele" = p_modele)
        )
      GROUP BY
        r."Marque",
        r."Famille",
        r."MY",
        r."Modele"
    ),

    -- La moyenne de segment conserve tous les véhicules,
    -- y compris ceux ayant moins de trois essais.
    all_for_avg AS (
      SELECT vehicle_avg_raw
      FROM segment_vehicles

      UNION ALL

      SELECT v_entity_avg_score
    ),

    -- Le rang ne conserve que les véhicules fiables.
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

    -- Règle strictement identique à get_model_ranking_v3 :
    -- 1) moyenne arrondie à 1 décimale, décroissante
    -- 2) nombre d'essais, décroissant
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

  -- 4. JSON retourné à Next.js
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
        'percentage', ROUND(
          (v_dist_pos_count::numeric / v_entity_reviews_count) * 100
        )
      ),
      'mixed', jsonb_build_object(
        'count', v_dist_mix_count,
        'percentage', ROUND(
          (v_dist_mix_count::numeric / v_entity_reviews_count) * 100
        )
      ),
      'negative', jsonb_build_object(
        'count', v_dist_neg_count,
        'percentage', ROUND(
          (v_dist_neg_count::numeric / v_entity_reviews_count) * 100
        )
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


ALTER FUNCTION "public"."get_vehicle_seo_stats"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_cars_v13"("search_term" "text") RETURNS TABLE("Marque" "text", "Famille" "text", "Modele" "text", "Type" "text", "MaxMY" integer)
    LANGUAGE "plpgsql"
    AS $$DECLARE
  keywords text[];
BEGIN
  -- 1. Préparation des mots-clés
  SELECT array_agg('%' || unaccent(word) || '%')
  INTO keywords
  FROM unnest(string_to_array(trim(search_term), ' ')) AS word
  WHERE length(word) > 0;

  IF keywords IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH base_search AS (
    SELECT 
      r."Marque",
      r."Famille",
      r."Modele",
      r."MY"
    FROM reviews r
    WHERE unaccent(concat(
      CASE WHEN r."Marque" = 'VW' THEN 'VW Volkswagen'
           WHEN r."Marque" = 'Mercedes' THEN 'Mercedes Mercedes-Benz'
           ELSE r."Marque" END, 
      ' ', r."Famille", ' ', r."Modele", ' ', r."MY"::text
    )) ILIKE ALL(keywords)
  )
  
  -- 2. FAMILLES
  (
    SELECT 
      bs."Marque",
      MAX(bs."Famille") AS "Famille",
      NULL::text AS "Modele", 
      'family'::text AS "Type",
      NULL::integer AS "MaxMY"
    FROM base_search bs
    GROUP BY bs."Marque", UPPER(TRIM(bs."Famille"))
    ORDER BY count(*) DESC
    LIMIT 3
  )
  UNION ALL
  -- 3. MODÈLES
  (
    SELECT 
      bs."Marque", 
      MAX(bs."Famille") AS "Famille",
      MAX(bs."Modele") AS "Modele",
      'model'::text AS "Type",
      MAX(bs."MY") AS "MaxMY"
    FROM base_search bs
    GROUP BY bs."Marque", UPPER(TRIM(bs."Famille")), UPPER(TRIM(bs."Modele"))
    ORDER BY count(*) DESC
    LIMIT 20
  );
END;$$;


ALTER FUNCTION "public"."search_cars_v13"("search_term" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_text"("value" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_slug text;
BEGIN
  -- 1. Minuscules et gestion des remplacements manuels (+, &, °, .)
  v_slug := lower(value);
  v_slug := replace(v_slug, '+', ' plus');
  v_slug := replace(v_slug, '&', 'and');
  v_slug := replace(v_slug, '°', '');
  v_slug := replace(v_slug, '.', '-');

  -- 2. Enlever les accents (nécessite l'extension unaccent activée sur Supabase)
  v_slug := unaccent(v_slug);

  -- 3. Remplacer les espaces par des tirets
  v_slug := regexp_replace(v_slug, '\s+', '-', 'g');

  -- 4. Supprimer tout ce qui N'EST PAS (lettre, chiffre, underscore ou tiret)
  -- L'équivalent exact de votre [^\w\-]+ en JS
  v_slug := regexp_replace(v_slug, '[^\w-]+', '', 'g');

  -- 5. Remplacer les tirets multiples par un seul
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');

  -- 6. Retirer les tirets au début et à la fin
  v_slug := trim(both '-' from v_slug);

  RETURN v_slug;
END;
$$;


ALTER FUNCTION "public"."slugify_text"("value" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."model_segments" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "Marque" "text" NOT NULL,
    "Modele" "text" NOT NULL,
    "Macro_Category" "text" NOT NULL,
    "Segment_Size" "text" NOT NULL,
    "MY" smallint NOT NULL
);


ALTER TABLE "public"."model_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "MY" smallint NOT NULL,
    "Marque" "text" NOT NULL,
    "Famille" "text" NOT NULL,
    "Modele" "text" NOT NULL,
    "Puissance" smallint NOT NULL,
    "Type" "text" NOT NULL,
    "Transmission" "text" NOT NULL,
    "Finition" "text",
    "Testeur" "text" NOT NULL,
    "Test_date" "date" NOT NULL,
    "Score" smallint NOT NULL
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."missing_segments_2021" WITH ("security_invoker"='on') AS
 SELECT DISTINCT "r"."Marque",
    "r"."Modele",
    "r"."MY",
    "count"(*) AS "review_count"
   FROM ("public"."reviews" "r"
     LEFT JOIN "public"."model_segments" "s" ON ((("r"."Marque" = "s"."Marque") AND ("r"."Modele" = "s"."Modele") AND ("r"."MY" = "s"."MY"))))
  WHERE (("s"."Marque" IS NULL) AND ("r"."MY" >= 2021))
  GROUP BY "r"."Marque", "r"."Modele", "r"."MY"
 HAVING ("count"(*) >= 3)
  ORDER BY ("count"(*)) DESC, "r"."Marque", "r"."Modele", "r"."MY" DESC;


ALTER VIEW "public"."missing_segments_2021" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."model_aliases" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "canonical_marque" "text" NOT NULL,
    "canonical_famille" "text" NOT NULL,
    "canonical_modele" "text",
    "alias_marque" "text" NOT NULL,
    "alias_famille" "text" NOT NULL,
    "alias_modele" "text",
    "canonical_my" integer
);


ALTER TABLE "public"."model_aliases" OWNER TO "postgres";


ALTER TABLE "public"."model_aliases" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."model_aliases_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."model_segments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."model_segments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."reviews" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."model_aliases"
    ADD CONSTRAINT "model_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_segments"
    ADD CONSTRAINT "model_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_model_aliases_canonical" ON "public"."model_aliases" USING "btree" ("canonical_marque", "canonical_famille");



CREATE INDEX "idx_model_aliases_search" ON "public"."model_aliases" USING "btree" ("alias_marque", "alias_famille", "alias_modele");



CREATE INDEX "idx_model_segments_lookup" ON "public"."model_segments" USING "btree" ("Marque", "Modele", "MY", "Macro_Category", "Segment_Size");



CREATE UNIQUE INDEX "idx_model_segments_unique" ON "public"."model_segments" USING "btree" ("Marque", "Modele", "MY");



CREATE INDEX "idx_reviews_seo_lookup" ON "public"."reviews" USING "btree" ("Marque", "Famille", "MY", "Modele", "Score");



CREATE UNIQUE INDEX "unique_review_entry" ON "public"."reviews" USING "btree" ("MY", "Marque", "Famille", "Modele", "Puissance", "Type", "Transmission", "Finition", "Testeur", "Test_date", "Score") NULLS NOT DISTINCT;



CREATE POLICY "Allow public read on model_aliases" ON "public"."model_aliases" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Lecture publique autorisée" ON "public"."reviews" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."model_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."model_segments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."find_brand_by_slug"("slug_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_brand_by_slug"("slug_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_brand_by_slug"("slug_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_family_by_slug"("real_brand_name" "text", "family_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_family_by_slug"("real_brand_name" "text", "family_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_family_by_slug"("real_brand_name" "text", "family_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_model_by_slug"("real_brand_name" "text", "real_family_name" "text", "target_my" integer, "model_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_model_by_slug"("real_brand_name" "text", "real_family_name" "text", "target_my" integer, "model_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_model_by_slug"("real_brand_name" "text", "real_family_name" "text", "target_my" integer, "model_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_type_by_slug"("type_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_type_by_slug"("type_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_type_by_slug"("type_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_ranking_v3"("min_my" integer, "min_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_ranking_v3"("min_my" integer, "min_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_ranking_v3"("min_my" integer, "min_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_break_ranking"("min_my" integer, "limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_break_ranking"("min_my" integer, "limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_break_ranking"("min_my" integer, "limit_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_convertible_ranking"("min_my" integer, "limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_convertible_ranking"("min_my" integer, "limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_convertible_ranking"("min_my" integer, "limit_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_families_by_brand"("brand_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_families_by_brand"("brand_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_families_by_brand"("brand_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_full_context_by_slugs"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_full_context_by_slugs"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_full_context_by_slugs"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_homepage_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_homepage_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_homepage_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_model_ranking_v3"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_model_ranking_v3"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_model_ranking_v3"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sitemap_groups_filtered"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_sitemap_groups_filtered"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sitemap_groups_filtered"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_models"("limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_models"("limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_models"("limit_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vehicle_seo_stats"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vehicle_seo_stats"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vehicle_seo_stats"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_cars_v13"("search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_cars_v13"("search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_cars_v13"("search_term" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_text"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_text"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_text"("value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";


















GRANT ALL ON TABLE "public"."model_segments" TO "anon";
GRANT ALL ON TABLE "public"."model_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."model_segments" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."missing_segments_2021" TO "anon";
GRANT ALL ON TABLE "public"."missing_segments_2021" TO "authenticated";
GRANT ALL ON TABLE "public"."missing_segments_2021" TO "service_role";



GRANT ALL ON TABLE "public"."model_aliases" TO "anon";
GRANT ALL ON TABLE "public"."model_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."model_aliases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."model_aliases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."model_aliases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."model_aliases_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."model_segments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."model_segments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."model_segments_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "Allow public read on model_aliases" on "public"."model_aliases";

drop policy "Lecture publique autorisée" on "public"."reviews";


  create policy "Allow public read on model_aliases"
  on "public"."model_aliases"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Lecture publique autorisée"
  on "public"."reviews"
  as permissive
  for select
  to anon, authenticated
using (true);



