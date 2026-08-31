-- Create search_cars_v14 function with alias support and canonical fields
CREATE OR REPLACE FUNCTION "public"."search_cars_v14"("search_term" "text")
RETURNS TABLE(
    "Marque" "text",
    "Famille" "text",
    "Modele" "text",
    "Type" "text",
    "MaxMY" integer,
    "DisplayName" "text",
    "CanonicalMarque" "text",
    "CanonicalFamille" "text",
    "CanonicalModele" "text"
)
LANGUAGE "plpgsql"
AS $$
DECLARE
  keywords text[];
BEGIN
  SELECT array_agg('%' || unaccent(word) || '%')
  INTO keywords
  FROM unnest(string_to_array(trim(search_term), ' ')) AS word
  WHERE length(word) > 0;

  IF keywords IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH raw_search AS (
    -- 1. Véhicules directs de reviews (hors alias pour éviter les doublons)
    SELECT
      r."Marque",
      r."Famille",
      r."Modele",
      r."MY",
      NULL::text AS alias_m,
      NULL::text AS alias_f,
      NULL::text AS alias_mo
    FROM reviews r
    WHERE unaccent(concat(
      CASE WHEN r."Marque" = 'VW' THEN 'VW Volkswagen'
           WHEN r."Marque" = 'Mercedes' THEN 'Mercedes Mercedes-Benz'
           ELSE r."Marque" END,
      ' ', r."Famille", ' ', r."Modele", ' ', r."MY"::text
    )) ILIKE ALL(keywords)
    AND NOT EXISTS (
      SELECT 1 FROM model_aliases ma
      WHERE ma.alias_marque = r."Marque"
        AND ma.alias_famille = r."Famille"
        AND (ma.alias_modele IS NULL OR ma.alias_modele = r."Modele")
    )

    UNION ALL

    -- 2. Alias déclarés dans model_aliases
    SELECT
      ma."canonical_marque" AS "Marque",
      ma."canonical_famille" AS "Famille",
      COALESCE(
        ma."canonical_modele",
        (SELECT r_canon."Modele" FROM reviews r_canon WHERE r_canon."Marque" = ma."canonical_marque" AND r_canon."Famille" = ma."canonical_famille" AND r_canon."MY" = r."MY" LIMIT 1),
        (SELECT r_canon."Modele" FROM reviews r_canon WHERE r_canon."Marque" = ma."canonical_marque" AND r_canon."Famille" = ma."canonical_famille" LIMIT 1),
        r."Modele"
      ) AS "Modele",
      r."MY",
      ma."alias_marque" AS alias_m,
      ma."alias_famille" AS alias_f,
      ma."alias_modele" AS alias_mo
    FROM model_aliases ma
    JOIN reviews r ON r."Marque" = ma."alias_marque" AND r."Famille" = ma."alias_famille"
      AND (ma."alias_modele" IS NULL OR r."Modele" = ma."alias_modele")
    WHERE unaccent(concat(
      CASE WHEN ma."alias_marque" = 'VW' THEN 'VW Volkswagen'
           WHEN ma."alias_marque" = 'Mercedes' THEN 'Mercedes Mercedes-Benz'
           ELSE ma."alias_marque" END,
      ' ', ma."alias_famille", ' ', COALESCE(ma."alias_modele", r."Modele"), ' ', r."MY"::text
    )) ILIKE ALL(keywords)
  )
  (
    -- FAMILLES
    SELECT
      rs."Marque",
      MAX(rs."Famille") AS "Famille",
      NULL::text AS "Modele",
      'family'::text AS "Type",
      NULL::integer AS "MaxMY",
      CASE
        WHEN MAX(rs.alias_m) IS NOT NULL THEN
          MAX(rs.alias_m) || ' ' || MAX(rs.alias_f) || ' (' || rs."Marque" || ' ' || MAX(rs."Famille") || ')'
        ELSE NULL::text
      END AS "DisplayName",
      rs."Marque" AS "CanonicalMarque",
      MAX(rs."Famille") AS "CanonicalFamille",
      NULL::text AS "CanonicalModele"
    FROM raw_search rs
    GROUP BY rs."Marque", UPPER(TRIM(rs."Famille")), rs.alias_f
    ORDER BY count(*) DESC
    LIMIT 3
  )
  UNION ALL
  (
    -- MODÈLES
    SELECT
      rs."Marque",
      MAX(rs."Famille") AS "Famille",
      MAX(rs."Modele") AS "Modele",
      'model'::text AS "Type",
      MAX(rs."MY") AS "MaxMY",
      CASE
        WHEN MAX(rs.alias_m) IS NOT NULL THEN
          MAX(rs.alias_m) || ' ' || COALESCE(MAX(rs.alias_mo), MAX(rs.alias_f)) || ' (' || rs."Marque" || ' ' || MAX(rs."Famille") || ')'
        ELSE NULL::text
      END AS "DisplayName",
      rs."Marque" AS "CanonicalMarque",
      MAX(rs."Famille") AS "CanonicalFamille",
      MAX(rs."Modele") AS "CanonicalModele"
    FROM raw_search rs
    WHERE rs."Modele" IS NOT NULL
    GROUP BY rs."Marque", UPPER(TRIM(rs."Famille")), UPPER(TRIM(rs."Modele")), rs.alias_mo
    ORDER BY count(*) DESC
    LIMIT 20
  );
END;
$$;

REVOKE ALL ON FUNCTION "public"."search_cars_v14"("search_term" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."search_cars_v14"("search_term" "text") TO "anon", "authenticated", "service_role";
