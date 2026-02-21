'use server';

import { createClient } from '@supabase/supabase-js';
import { Review } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    console.error("❌ Crash Server Action:", err);
    return [];
  }
}

export async function fetchBatchFighterReviews(slugs: string[]): Promise<Record<string, Review[]>> {
  console.log("⚡ Batch Server Action Triggered for:", slugs);

  if (!slugs || slugs.length === 0) return {};

  try {
    // We use Promise.all to fetch reviews for all slugs in parallel.
    // While this results in multiple DB queries, it consolidates Client-Server communication
    // into a single request, which is the primary performance bottleneck to solve.
    // This also ensures we reuse the exact safely implemented query logic of fetchFighterReviews
    // without risking SQL injection or syntax errors with manual OR string construction.
    const results = await Promise.all(
      slugs.map(async (slug) => {
        const reviews = await fetchFighterReviews(slug);
        return { slug, reviews };
      })
    );

    const groupedReviews: Record<string, Review[]> = {};
    results.forEach(({ slug, reviews }) => {
      groupedReviews[slug] = reviews;
    });

    return groupedReviews;
  } catch (err) {
    console.error("❌ Crash Batch Server Action:", err);
    return {};
  }
}
