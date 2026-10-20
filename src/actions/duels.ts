'use server';

import { unstable_cache } from 'next/cache';
import { Review } from "@/lib/types";
import { getFullContext, getReviews } from "@/lib/queries";
import {
  isValidSlugPart,
  isValidModelPart,
  isValidYear,
} from "@/lib/validation";

// DuelPageClient has two slots. Bound the raw input before deduplication so an
// oversized request cannot spend unbounded time validating or building cache keys.
const MAX_FIGHTERS = 2;
// Leaves room for long vehicle names while bounding parsing and cache-key size.
const MAX_FIGHTER_SLUG_LENGTH = 256;

function parseFighterSlug(slug: string) {
  if (slug.length === 0 || slug.length > MAX_FIGHTER_SLUG_LENGTH) {
    throw new Error('Invalid fighter slug length');
  }
  if (/[^a-z0-9_-]/.test(slug)) {
    throw new Error('Invalid fighter slug characters');
  }

  const [marqueSlug, familleSlug, yearPart, ...modelParts] = slug.split('_');
  const modeleSlug = modelParts.join('_');
  const my = Number(yearPart);

  if (
    !isValidSlugPart(marqueSlug ?? '') ||
    !isValidSlugPart(familleSlug ?? '') ||
    !/^\d{4}$/.test(yearPart ?? '') ||
    !isValidYear(my) ||
    !isValidModelPart(modeleSlug)
  ) {
    throw new Error('Invalid fighter slug format or model year');
  }

  return { marqueSlug, familleSlug, my, modeleSlug };
}

/**
 * Internal function to perform the actual DB query for multiple slugs.
 */
async function _fetchBatchReviews(slugs: string[]): Promise<Record<string, Review[]>> {
  if (!slugs || slugs.length === 0) return {};

  // Resolve all slugs in parallel
  const resolvedContexts = await Promise.all(
    slugs.map(async (slug) => {
      const { marqueSlug, familleSlug, my, modeleSlug } = parseFighterSlug(slug);

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
export async function fetchBatchFighterReviews(slugs: unknown): Promise<Record<string, Review[]>> {
  if (!Array.isArray(slugs) || slugs.length > MAX_FIGHTERS) {
    throw new Error('Expected an array of at most two fighter slugs');
  }

  // Validate the entire batch before touching the cache or resolving any vehicle.
  // TypeScript types alone do not validate a remotely invoked Server Action.
  const validatedSlugs: string[] = [];
  for (const slug of slugs) {
    if (typeof slug !== 'string') {
      throw new Error('Expected fighter slugs to be strings');
    }
    parseFighterSlug(slug);
    validatedSlugs.push(slug);
  }

  const uniqueSlugs = Array.from(new Set(validatedSlugs));

  if (uniqueSlugs.length === 0) return {};

  // Sort to ensure [A, B] and [B, A] hit the same cache key
  uniqueSlugs.sort();

  return getCachedBatchReviews(uniqueSlugs);
}
