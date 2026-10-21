-- Q4: the maintainer confirms there are no consumers outside this repository.
-- Inventory: docs/validation/Q4-rpc-cleanup.md. Keep the 12 application RPCs,
-- their SQL helpers slugify_text/normalize_media_source, and extension functions.
-- Deploy only after the application calling the current Q2 RPCs is live.
-- Rollbacks to clients using retired names require restoring those functions.
-- Exact signatures and RESTRICT prevent an unexpected dependency from being
-- silently removed. One DROP statement makes the removal atomic.
DROP FUNCTION IF EXISTS
  -- Superseded brand/family/context/search endpoints (5).
  public.find_brand_by_slug(text),
  public.get_families_by_brand(text),
  public.get_full_context_by_slugs(text, text, integer, text, text),
  public.get_full_context_by_slugs_v2(text, text, integer, text, text),
  public.search_cars_v13(text),
  -- Superseded brand rankings (6).
  public.get_brand_ranking_v3(integer, integer),
  public.get_brand_ranking_v4(integer, integer),
  public.get_brand_ranking_v5(integer, integer),
  public.get_brand_ranking_v6(integer, integer),
  public.get_brand_ranking_v7(integer, integer),
  public.get_brand_ranking_v8(integer, integer),
  -- Superseded model/body-style/trending endpoints (19), including the
  -- 15 unbounded endpoints from #88 and their four pre-Q2 successors.
  public.get_model_ranking_v3(integer, text, text, text, text, integer),
  public.get_model_ranking_v4(integer, text, text, text, text, integer),
  public.get_model_ranking_v5(integer, text, text, text, text, integer),
  public.get_model_ranking_v6(integer, text, text, text, text, integer),
  public.get_model_ranking_v7(integer, text, text, text, text, integer),
  public.get_break_ranking(integer, integer),
  public.get_break_ranking_v2(integer, integer),
  public.get_break_ranking_v3(integer, integer),
  public.get_break_ranking_v4(integer, integer),
  public.get_break_ranking_v5(integer, integer),
  public.get_convertible_ranking(integer, integer),
  public.get_convertible_ranking_v2(integer, integer),
  public.get_convertible_ranking_v3(integer, integer),
  public.get_convertible_ranking_v4(integer, integer),
  public.get_convertible_ranking_v5(integer, integer),
  public.get_trending_models(integer),
  public.get_trending_models_v2(integer),
  public.get_trending_models_v3(integer),
  public.get_trending_models_v4(integer),
  -- Superseded SEO endpoints (5).
  public.get_vehicle_seo_stats(text, text, integer, text),
  public.get_vehicle_seo_stats_v2(text, text, integer, text),
  public.get_vehicle_seo_stats_v3(text, text, integer, text),
  public.get_vehicle_seo_stats_v4(text, text, integer, text),
  public.get_vehicle_seo_stats_v5(text, text, integer, text)
RESTRICT;

NOTIFY pgrst, 'reload schema';
