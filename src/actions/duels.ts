'use server';

import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { Review } from "@/lib/types";
import { getFullContext } from "@/lib/queries";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Validation Helpers ---

function isValidSlugPart(part: string): boolean {
  // Allow alphanumeric, hyphens.
  // Strictly disallow quotes, slashes, and other special chars to prevent injection/XSS.
  // Underscores are NOT allowed in marque/famille because they are separators in the composite slug.
  // Enforcing lowercase for strict slug compliance.
  return /^[a-z0-9\-]+$/.test(part);
}

function isValidModelPart(part: string): boolean {
  // Models can contain underscores if they were joined back from parts,
  // or spaces if passed raw.
  // Strictly disallow quotes.
  // Enforcing lowercase for strict slug compliance.
  return /^[a-z0-9\-_]+$/.test(part);
}

function isValidYear(year: number): boolean {
  return !isNaN(year) && year >= 1900 && year <= 2100;
}

// --- Legacy Function (Still exported for compatibility if needed, but we'll try to move away from it) ---
export async function fetchFighterReviews(slug: string): Promise<Review[]> {
  console.log("⚡ Server Action Triggered for:", slug); // Log serveur (visible dans le terminal, pas le navigateur)

  try {
    if (!slug) return [];
    
    const parts = slug.split("_");
    if (parts.length < 4) {
      console.error("❌ Slug invalide:", slug);
      return [];
    }

    const marqueSlug = parts[0];
    const familleSlug = parts[1];
    const my = parseInt(parts[2]);
    const modeleSlug = parts.slice(3).join("_"); // Join back in case modele slug has underscores (though discouraged)

    // 🔒 Security Validation
    if (!isValidSlugPart(marqueSlug) || !isValidSlugPart(familleSlug) || !isValidYear(my) || !isValidModelPart(modeleSlug)) {
      console.error("❌ Slug rejected by security validation:", slug);
      return [];
    }

    // Resolve context using RPC
    const context = await getFullContext({
      p_marque_slug: marqueSlug,
      p_famille_slug: familleSlug,
      p_my: my,
      p_modele_slug: modeleSlug
    });

    if (!context || !context.real_marque || !context.real_famille || !context.real_modele) {
      console.warn("⚠️ Could not resolve context for slug:", slug);
      return [];
    }

    // Requête using resolved real names
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('Marque', context.real_marque)
      .eq('Famille', context.real_famille)
      .eq('MY', my)
      .eq('Modele', context.real_modele);

    if (error) {
      console.error("❌ Erreur Supabase:", error.message);
      return [];
    }

    return (data as Review[]) || [];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Crash Server Action:", errorMessage);
    return [];
  }
}

// --- New Cached Batch Function ---

/**
 * Internal function to perform the actual DB query for multiple slugs.
 */
async function _fetchBatchReviews(slugs: string[]): Promise<Record<string, Review[]>> {
  console.log("⚡ Batch DB Query Triggered for:", slugs);

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

  const conditions = validContexts.map(ctx => {
    // PostgREST syntax: wrap strings in quotes to handle special chars (except numbers)
    return `and(Marque.eq."${ctx.real_marque}",Famille.eq."${ctx.real_famille}",MY.eq.${ctx.my},Modele.eq."${ctx.real_modele}")`;
  });

  // Join with comma for OR operator in PostgREST
  const orQuery = conditions.join(',');

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .or(orQuery);

  if (error) {
    console.error("❌ Erreur Supabase Batch:", error.message);
    return {};
  }

  const reviews = (data as Review[]) || [];
  const result: Record<string, Review[]> = {};

  // Initialize result arrays for requested slugs
  slugs.forEach(s => result[s] = []);

  // Group reviews by slug
  // Note: We need to map back from (Real Names) -> (Original Slug)
  // Since multiple slugs might map to same real car (unlikely but possible), or we just iterate contexts

  reviews.forEach(r => {
    // Find matching context(s)
    const matchingContexts = validContexts.filter(ctx =>
      ctx.real_marque === r.Marque &&
      ctx.real_famille === r.Famille &&
      ctx.my === r.MY &&
      ctx.real_modele === r.Modele
    );

    matchingContexts.forEach(ctx => {
      if (result[ctx.slug]) {
        result[ctx.slug].push(r);
      }
    });
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
