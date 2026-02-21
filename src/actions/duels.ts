'use server';

import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { Review } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    const marque = parts[0];
    const famille = parts[1];
    const my = parseInt(parts[2]);
    const modele = parts.slice(3).join("_");

    // Requête
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('Marque', marque)
      .eq('Famille', famille)
      .eq('MY', my)
      .eq('Modele', modele);

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

  const conditions = slugs.map(slug => {
    const parts = slug.split("_");
    if (parts.length < 4) return null;
    const marque = parts[0];
    const famille = parts[1];
    const my = parseInt(parts[2]);
    const modele = parts.slice(3).join("_");

    if (isNaN(my)) return null;

    // PostgREST syntax: wrap strings in quotes to handle special chars (except numbers)
    return `and(Marque.eq."${marque}",Famille.eq."${famille}",MY.eq.${my},Modele.eq."${modele}")`;
  }).filter(Boolean);

  if (conditions.length === 0) return {};

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
  reviews.forEach(r => {
    // Reconstruct the slug key
    const key = `${r.Marque}_${r.Famille}_${r.MY}_${r.Modele}`;
    if (result[key]) {
      result[key].push(r);
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
  ['batch-fighter-reviews-v1'], // Cache key prefix
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
