-- Add segmentation to brand directories without changing the v2 card/count contract.
CREATE OR REPLACE FUNCTION public.get_families_by_brand_v3(brand_name text)
RETURNS TABLE (
  "Famille" text,
  review_count bigint,
  is_alias boolean,
  canonical_marque text,
  canonical_famille text,
  latest_my integer,
  segments jsonb
)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cards AS MATERIALIZED (
    SELECT c.*,
      COALESCE(c.canonical_marque, brand_name) AS target_marque,
      COALESCE(c.canonical_famille, c."Famille") AS target_famille
    FROM public.get_families_by_brand_v2(brand_name) c
  ),
  family_vehicles AS MATERIALIZED (
    -- Only metadata is joined below: v2 remains the source of review counts.
    SELECT DISTINCT
      COALESCE(ma.canonical_marque, r."Marque") AS c_marque,
      COALESCE(ma.canonical_famille, r."Famille") AS c_famille,
      COALESCE(ma.canonical_modele, canonical_model."Modele", r."Modele") AS c_modele,
      r."MY"::integer AS my,
      r."Marque" AS original_marque,
      r."Modele" AS original_modele
    FROM public.reviews r
    LEFT JOIN public.model_aliases ma
      ON LOWER(r."Marque") = LOWER(ma.alias_marque)
     AND LOWER(r."Famille") = LOWER(ma.alias_famille)
     AND (ma.alias_modele IS NULL OR LOWER(r."Modele") = LOWER(ma.alias_modele))
    LEFT JOIN LATERAL (
      SELECT rc."Modele"
      FROM public.reviews rc
      WHERE ma.canonical_marque IS NOT NULL
        AND ma.canonical_modele IS NULL
        AND LOWER(rc."Marque") = LOWER(ma.canonical_marque)
        AND LOWER(rc."Famille") = LOWER(ma.canonical_famille)
      ORDER BY (rc."MY" = r."MY") DESC, rc."MY" DESC, rc."Modele", rc.id
      LIMIT 1
    ) canonical_model ON TRUE
    WHERE EXISTS (
      SELECT 1 FROM cards c
      WHERE LOWER(c.target_marque) = LOWER(COALESCE(ma.canonical_marque, r."Marque"))
        AND LOWER(c.target_famille) = LOWER(COALESCE(ma.canonical_famille, r."Famille"))
    )
  ),
  segmented_vehicles AS MATERIALIZED (
    SELECT v.*, s.macro, s.size
    FROM family_vehicles v
    LEFT JOIN LATERAL (
      SELECT ms."Macro_Category" AS macro, ms."Segment_Size" AS size
      FROM public.model_segments ms
      WHERE (LOWER(ms."Marque") = LOWER(v.c_marque) AND ms."Modele" = v.c_modele)
         OR (LOWER(ms."Marque") = LOWER(v.original_marque) AND ms."Modele" = v.original_modele)
      -- Prefer canonical identity, then the exact MY, then the latest available MY.
      -- Original identity is a fallback when only the rebadged model is segmented.
      ORDER BY (LOWER(ms."Marque") = LOWER(v.c_marque) AND ms."Modele" = v.c_modele) DESC,
        (ms."MY" = v.my) DESC, ms."MY" DESC, ms.id
      LIMIT 1
    ) s ON TRUE
  ),
  family_years AS (
    SELECT LOWER(v.c_marque) AS marque, LOWER(v.c_famille) AS famille, MAX(v.my) AS latest_my
    FROM family_vehicles v
    GROUP BY LOWER(v.c_marque), LOWER(v.c_famille)
  ),
  segment_years AS (
    SELECT LOWER(v.c_marque) AS marque, LOWER(v.c_famille) AS famille,
      v.macro, v.size, MAX(v.my) AS latest_my
    FROM segmented_vehicles v
    WHERE v.macro IS NOT NULL AND v.size IS NOT NULL
    GROUP BY LOWER(v.c_marque), LOWER(v.c_famille), v.macro, v.size
  ),
  family_segments AS (
    SELECT s.marque, s.famille,
      jsonb_agg(jsonb_build_object('macro', s.macro, 'size', s.size, 'latest_my', s.latest_my)
        ORDER BY s.macro, s.size) AS segments
    FROM segment_years s
    GROUP BY s.marque, s.famille
  )
  SELECT c."Famille", c.review_count, c.is_alias, c.canonical_marque, c.canonical_famille,
    y.latest_my, COALESCE(s.segments, '[]'::jsonb)
  FROM cards c
  LEFT JOIN family_years y
    ON y.marque = LOWER(c.target_marque) AND y.famille = LOWER(c.target_famille)
  LEFT JOIN family_segments s
    ON s.marque = LOWER(c.target_marque) AND s.famille = LOWER(c.target_famille)
  ORDER BY c.review_count DESC, c."Famille" ASC;
$$;

-- Match v2's API roles and inherited PUBLIC execution; leave v2 unchanged.
REVOKE ALL ON FUNCTION public.get_families_by_brand_v3(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_families_by_brand_v3(text) TO anon, authenticated, service_role;
