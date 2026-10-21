-- The maintainer confirmed that these sitemap RPCs have no other consumers.
-- Keep the active get_sitemap_groups_filtered_v4 endpoint and historical migrations.
-- RESTRICT deliberately stops the migration if a database dependency remains.
DROP FUNCTION IF EXISTS public.get_sitemap_groups_filtered() RESTRICT;
DROP FUNCTION IF EXISTS public.get_sitemap_groups_filtered_v2() RESTRICT;
DROP FUNCTION IF EXISTS public.get_sitemap_groups_filtered_v3() RESTRICT;
DROP FUNCTION IF EXISTS public.get_sitemap_canonical_routes() RESTRICT;
DROP FUNCTION IF EXISTS public.get_sitemap_canonical_routes_v2() RESTRICT;
DROP FUNCTION IF EXISTS public.get_sitemap_canonical_routes_v3() RESTRICT;
