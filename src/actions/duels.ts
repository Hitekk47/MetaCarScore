'use server';

import { unstable_cache } from 'next/cache';
import { Review } from "@/lib/types";
import { getFullContext } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import {
  isValidSlugPart,
  isValidModelPart,
  isValidYear,
  escapePostgrestValue
} from "@/lib/validation";

// --- New Cached Batch Function ---

/**
 * Internal function to perform the actual DB query for multiple slugs.
 */
async function _fetchBatchReviews(slugs: string[]): Promise<Record<string, Review[]>> {
  if (!slugs || slugs.length === 0) return {};

  // Resolve all slugs in parallel
  const resolvedContexts = await Promise.all(
    slugs.map(async (slug) => {
      const parts = slug.split("_");
      if (parts.length < 4) return null;

      const marqueSlug = parts[0];
      const familleSlug = parts[1];
      const my = parseInt(parts[2]);
      const modeleSlug = parts.slice(3).join("_");

      // 🔒 Security Validation
      if (!isValidSlugPart(marqueSlug) || !isValidSlugPart(familleSlug) || !isValidYear(my) || !isValidModelPart(modeleSlug)) {
        console.warn("⚠️ Invalid slug component detected, skipping:", slug);
        return null;
      }

      // Call RPC
      const context = await getFullContext({
        p_marque_slug: marqueSlug,
        p_famille_slug: familleSlug,
        p_my: my,
        p_modele_slug: modeleSlug
      });

      if (!context || !context.real_marque || !context.real_famille || !context.real_modele) {
        return null;
      }

      return {
        slug, // Keep original slug for mapping result back
        real_marque: context.real_marque,
        real_famille: context.real_famille,
        real_modele: context.real_modele,
        my // Ensure we use the parsed MY
      };
    })
  );

  const validContexts = resolvedContexts.filter(c => c !== null) as NonNullable<typeof resolvedContexts[number]>[];

  if (validContexts.length === 0) return {};

  // To avoid exceeding Supabase PostgREST URL limits (usually ~8KB max for GET, but conservative at 50 to avoid any risk),
  // we chunk the valid contexts and query them in batches.
  const BATCH_SIZE = 50;
  let reviews: Review[] = [];

  for (let i = 0; i < validContexts.length; i += BATCH_SIZE) {
    const chunk = validContexts.slice(i, i + BATCH_SIZE);
    const conditions = chunk.map(ctx => {
      // PostgREST syntax: wrap strings in quotes to handle special chars (except numbers).
      // 🔒 Security: Double quotes within values must be escaped by prefixing them with backslash (\").
      const m = escapePostgrestValue(ctx.real_marque);
      const f = escapePostgrestValue(ctx.real_famille);
      const mod = escapePostgrestValue(ctx.real_modele);
      return `and(Marque.eq."${m}",Famille.eq."${f}",MY.eq.${ctx.my},Modele.eq."${mod}")`;
    });

    // Join with comma for OR operator in PostgREST
    const orQuery = conditions.join(',');

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .or(orQuery);

    if (error) {
      console.error("❌ Erreur Supabase Batch: An unexpected error occurred in chunk", i);
      // We continue to other chunks, returning what we have, or could fail the whole batch.
      // Deciding to continue to return partial results is safer.
      continue;
    }

    if (data) {
      reviews = reviews.concat(data as Review[]);
    }
  }
  const result: Record<string, Review[]> = {};

  // Initialize result arrays for requested slugs
  slugs.forEach(s => result[s] = []);

  // Group reviews by slug
  // Note: We need to map back from (Real Names) -> (Original Slug)
  // Since multiple slugs might map to same real car (unlikely but possible), or we just iterate contexts

  // Create an O(1) lookup map using a composite key
  // Using a pipe '|' character as separator because it doesn't appear in car names (unlike underscores or spaces)
  type ContextType = {
    slug: string;
    real_marque: string;
    real_famille: string;
    real_modele: string;
    my: number;
  };
  const contextMap = new Map<string, ContextType[]>();

  validContexts.forEach(ctx => {
    const key = `${ctx.real_marque}|${ctx.real_famille}|${ctx.my}|${ctx.real_modele}`;
    if (!contextMap.has(key)) {
      contextMap.set(key, []);
    }
    contextMap.get(key)!.push(ctx);
  });

  reviews.forEach(r => {
    const key = `${r.Marque}|${r.Famille}|${r.MY}|${r.Modele}`;
    const matchingContexts = contextMap.get(key);

    if (matchingContexts) {
      matchingContexts.forEach(ctx => {
        if (result[ctx.slug]) {
          result[ctx.slug].push(r);
        }
      });
    }
  });

  return result;
}

/**
 * Cached wrapper for the batch fetch function.
 */
const getCachedBatchReviews = unstable_cache(
  async (sortedSlugs: string[]) => {
    return _fetchBatchReviews(sortedSlugs);
  },
  ['batch-fighter-reviews-v2'], // Cache key prefix updated (v2)
  { revalidate: 3600 } // Revalidate every hour
);

/**
 * Public Server Action to fetch reviews for multiple slugs efficiently.
 * Sorts slugs to ensure consistent cache hits.
 */
export async function fetchBatchFighterReviews(slugs: string[]): Promise<Record<string, Review[]>> {
  // Filter out empty slugs and duplicates
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));

  if (uniqueSlugs.length === 0) return {};

  // Sort to ensure [A, B] and [B, A] hit the same cache key
  uniqueSlugs.sort();

  return getCachedBatchReviews(uniqueSlugs);
}
