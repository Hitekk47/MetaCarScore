-- Migration: 20260901000000_canonical_redirections_and_sitemap.sql
-- Description: Add get_full_context_by_slugs_v3 with alias metadata and add get_sitemap_canonical_routes RPC for unified canonical sitemap.

CREATE OR REPLACE FUNCTION "public"."get_full_context_by_slugs_v3"(
  "p_marque_slug" "text",
  "p_famille_slug" "text" DEFAULT NULL::"text",
  "p_my" integer DEFAULT NULL::integer,
  "p_modele_slug" "text" DEFAULT NULL::"text",
  "p_powertrain_slug" "text" DEFAULT NULL::"text"
) RETURNS TABLE(
  "real_marque" "text",
  "real_famille" "text",
  "real_modele" "text",
  "real_powertrain" "text",
  "is_alias" boolean,
  "canonical_marque" "text",
  "canonical_famille" "text",
  "canonical_modele" "text"
)
LANGUAGE "plpgsql"
AS $$
DECLARE
  v_marque text;
  v_famille text;
  v_modele text;
  v_powertrain text;
  v_is_alias boolean := FALSE;
  v_canonical_marque text;
  v_canonical_famille text;
  v_canonical_modele text;
BEGIN
  -- 1. Résolution Marque (directe ou via alias)
  SELECT m."Marque" INTO v_marque
  FROM (
    SELECT r."Marque" FROM public.reviews r WHERE slugify_text(r."Marque") = p_marque_slug
    UNION
    SELECT ma.canonical_marque FROM public.model_aliases ma WHERE slugify_text(ma.canonical_marque) = p_marque_slug
    UNION
    SELECT ma.alias_marque FROM public.model_aliases ma WHERE slugify_text(ma.alias_marque) = p_marque_slug
  ) m
  LIMIT 1;

  -- 2. Résolution Famille
  IF v_marque IS NOT NULL AND p_famille_slug IS NOT NULL THEN
    SELECT f."Famille" INTO v_famille
    FROM (
      SELECT r."Famille" FROM public.reviews r WHERE r."Marque" = v_marque AND slugify_text(r."Famille") = p_famille_slug
      UNION
      SELECT ma.canonical_famille FROM public.model_aliases ma WHERE ma.canonical_marque = v_marque AND slugify_text(ma.canonical_famille) = p_famille_slug
      UNION
      SELECT ma.alias_famille FROM public.model_aliases ma WHERE ma.alias_marque = v_marque AND slugify_text(ma.alias_famille) = p_famille_slug
    ) f
    LIMIT 1;
  END IF;

  -- 3. Résolution Modèle
  IF v_famille IS NOT NULL AND p_my IS NOT NULL AND p_modele_slug IS NOT NULL THEN
    SELECT mo."Modele" INTO v_modele
    FROM (
      SELECT r."Modele" FROM public.reviews r WHERE r."Marque" = v_marque AND r."Famille" = v_famille AND r."MY" = p_my AND slugify_text(r."Modele") = p_modele_slug
      UNION
      SELECT COALESCE(ma.canonical_modele, r_c."Modele")
      FROM public.model_aliases ma
      LEFT JOIN public.reviews r_c ON r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille AND r_c."MY" = p_my
      WHERE (ma.canonical_marque = v_marque AND ma.canonical_famille = v_famille AND (ma.canonical_modele IS NULL OR slugify_text(ma.canonical_modele) = p_modele_slug))
         OR (ma.alias_marque = v_marque AND ma.alias_famille = v_famille AND (ma.alias_modele IS NULL OR slugify_text(ma.alias_modele) = p_modele_slug))
    ) mo
    WHERE mo."Modele" IS NOT NULL
    LIMIT 1;
  END IF;

  -- 4. Résolution Powertrain
  IF v_modele IS NOT NULL AND p_powertrain_slug IS NOT NULL THEN
    SELECT r."Type" INTO v_powertrain
    FROM public.reviews r
    WHERE (r."Marque" = v_marque OR EXISTS (SELECT 1 FROM public.model_aliases ma WHERE ma.canonical_marque = v_marque AND r."Marque" = ma.alias_marque))
      AND (r."Famille" = v_famille OR EXISTS (SELECT 1 FROM public.model_aliases ma WHERE ma.canonical_famille = v_famille AND r."Famille" = ma.alias_famille))
      AND r."MY" = p_my
      AND slugify_text(r."Type") = p_powertrain_slug
    LIMIT 1;
  END IF;

  -- 5. Détection Alias et Identifiants Canoniques
  IF v_marque IS NOT NULL AND p_famille_slug IS NOT NULL THEN
    SELECT
      TRUE,
      ma.canonical_marque,
      ma.canonical_famille,
      COALESCE(
        ma.canonical_modele,
        (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille AND (p_my IS NULL OR r_c."MY" = p_my) LIMIT 1),
        (SELECT r_c."Modele" FROM public.reviews r_c WHERE r_c."Marque" = ma.canonical_marque AND r_c."Famille" = ma.canonical_famille LIMIT 1)
      )
    INTO
      v_is_alias,
      v_canonical_marque,
      v_canonical_famille,
      v_canonical_modele
    FROM public.model_aliases ma
    WHERE slugify_text(ma.alias_marque) = p_marque_slug
      AND slugify_text(ma.alias_famille) = p_famille_slug
      AND (
        p_modele_slug IS NULL
        OR ma.alias_modele IS NULL
        OR slugify_text(ma.alias_modele) = p_modele_slug
      )
      AND (
        p_my IS NULL
        OR ma.canonical_my IS NULL
        OR ma.canonical_my = p_my
      )
    LIMIT 1;
  END IF;

  v_is_alias := COALESCE(v_is_alias, FALSE);

  RETURN QUERY SELECT v_marque, v_famille, v_modele, v_powertrain, v_is_alias, v_canonical_marque, v_canonical_famille, v_canonical_modele;
END;
$$;

REVOKE ALL ON FUNCTION "public"."get_full_context_by_slugs_v3"("text", "text", integer, "text", "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_full_context_by_slugs_v3"("text", "text", integer, "text", "text") TO "anon", "authenticated", "service_role";


-- -----------------------------------------------------------------------------
-- RPC: get_sitemap_canonical_routes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_sitemap_canonical_routes"()
RETURNS TABLE(
  "route_type" "text",
  "marque" "text",
  "famille" "text",
  "my" "text",
  "modele" "text",
  "nb_essais" bigint
)
LANGUAGE "sql"
AS $$
  WITH normalized_reviews AS (
    SELECT
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      r."MY"::text AS c_my,
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
  ),
  families AS (
    SELECT
      'family'::text AS route_type,
      c_marque AS marque,
      c_famille AS famille,
      NULL::text AS my,
      NULL::text AS modele,
      COUNT(*) AS nb_essais
    FROM normalized_reviews
    GROUP BY c_marque, c_famille
    HAVING COUNT(*) >= 3
  ),
  mys AS (
    SELECT
      'my'::text AS route_type,
      c_marque AS marque,
      c_famille AS famille,
      c_my AS my,
      NULL::text AS modele,
      COUNT(*) AS nb_essais
    FROM normalized_reviews
    GROUP BY c_marque, c_famille, c_my
    HAVING COUNT(*) >= 3
  ),
  models AS (
    SELECT
      'model'::text AS route_type,
      c_marque AS marque,
      c_famille AS famille,
      c_my AS my,
      c_modele AS modele,
      COUNT(*) AS nb_essais
    FROM normalized_reviews
    GROUP BY c_marque, c_famille, c_my, c_modele
    HAVING COUNT(*) >= 3
  )
  SELECT * FROM families
  UNION ALL
  SELECT * FROM mys
  UNION ALL
  SELECT * FROM models;
$$;

REVOKE ALL ON FUNCTION "public"."get_sitemap_canonical_routes"() FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_sitemap_canonical_routes"() TO "anon", "authenticated", "service_role";
