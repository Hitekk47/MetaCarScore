
-- Function to get distinct sitemap data for optimized generation
-- Returns only unique combinations of Marque, Famille, MY, Modele
-- This replaces the need for fetching all rows and deduplicating in memory

CREATE OR REPLACE FUNCTION get_sitemap_data()
RETURNS TABLE (
  "Marque" text,
  "Famille" text,
  "MY" integer,
  "Modele" text
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT
    "Marque",
    "Famille",
    "MY",
    "Modele"
  FROM reviews
  WHERE "Famille" IS NOT NULL
    AND "Modele" IS NOT NULL;
$$;
