'use server';

import { unstable_cache } from 'next/cache';
import { Review } from "@/lib/types";
import { getFullContext, getReviews } from "@/lib/queries";
import {
  isValidSlugPart,
  isValidModelPart,
  isValidYear,
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

  const result: Record<string, Review[]> = {};

  // Initialize result arrays for requested slugs
  slugs.forEach(s => result[s] = []);

  if (validContexts.length === 0) return result;

  await Promise.all(
    validContexts.map(async (ctx) => {
      const reviews = await getReviews({
        marque: ctx.real_marque,
        famille: ctx.real_famille,
        my: ctx.my,
        modele: ctx.real_modele,
      });
      result[ctx.slug] = reviews;
    })
  );

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
