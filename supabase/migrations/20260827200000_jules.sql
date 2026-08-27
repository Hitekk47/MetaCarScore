-- 1. Suppression des fonctions inutilisées
DROP FUNCTION IF EXISTS "public"."find_family_by_slug"("real_brand_name" "text", "family_slug" "text");
DROP FUNCTION IF EXISTS "public"."find_model_by_slug"("real_brand_name" "text", "real_family_name" "text", "target_my" integer, "model_slug" "text");
DROP FUNCTION IF EXISTS "public"."find_type_by_slug"("type_slug" "text");

-- 2. Restriction des privilèges des fonctions (REVOKE ALL + GRANT EXECUTE) pour les rôles anon et authenticated
REVOKE ALL ON FUNCTION "public"."find_brand_by_slug"("slug_input" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."find_brand_by_slug"("slug_input" "text") TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_brand_ranking_v3"("min_my" integer, "min_count" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_brand_ranking_v3"("min_my" integer, "min_count" integer) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_break_ranking"("min_my" integer, "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_break_ranking"("min_my" integer, "limit_val" integer) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_convertible_ranking"("min_my" integer, "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_convertible_ranking"("min_my" integer, "limit_val" integer) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_families_by_brand"("brand_name" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_families_by_brand"("brand_name" "text") TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_full_context_by_slugs"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_full_context_by_slugs"("p_marque_slug" "text", "p_famille_slug" "text", "p_my" integer, "p_modele_slug" "text", "p_powertrain_slug" "text") TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_homepage_stats"() FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_homepage_stats"() TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_model_ranking_v3"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_model_ranking_v3"("min_my" integer, "category_filter" "text", "transmission_filter" "text", "macro_category_filter" "text", "segment_filter" "text", "limit_val" integer) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_sitemap_groups_filtered"() FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_sitemap_groups_filtered"() TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_trending_models"("limit_val" integer) FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_trending_models"("limit_val" integer) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_vehicle_seo_stats"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_vehicle_seo_stats"("p_marque" "text", "p_famille" "text", "p_my" integer, "p_modele" "text") TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."search_cars_v13"("search_term" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."search_cars_v13"("search_term" "text") TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."slugify_text"("value" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."slugify_text"("value" "text") TO "anon", "authenticated";
