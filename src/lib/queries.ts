import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { Review } from '@/lib/types';

// Types for RPC responses
export interface BrandContext {
  Marque: string;
}

export interface FullContext {
  real_marque: string | null;
  real_famille: string | null;
  real_modele: string | null;
  real_powertrain: string | null;
}

export interface FamilyItem {
  famille: string;
  review_count: number;
}

export type FullContextParams = {
  p_marque_slug?: string;
  p_famille_slug?: string;
  p_my?: number;
  p_modele_slug?: string;
  p_powertrain_slug?: string;
};

// 1. Cached Brand Context
export const getBrandContext = cache(async (slug: string) => {
  const { data, error } = await supabase.rpc('find_brand_by_slug', {
    slug_input: slug
  });

  if (error) {
    console.error('Error fetching brand context:', error);
    return null;
  }

  return (data?.[0] as BrandContext) || null;
});

// 2. Cached Full Context (Family, Model, Powertrain)
export const getFullContext = cache(async (params: FullContextParams) => {
  const { data, error } = await supabase.rpc('get_full_context_by_slugs', params);

  if (error) {
    console.error('Error fetching full context:', error);
    return null;
  }

  return (data?.[0] as FullContext) || null;
});

// 3. Cached Families List
export const getFamilies = cache(async (brandName: string) => {
  const { data, error } = await supabase.rpc('get_families_by_brand', {
    brand_name: brandName
  });

  if (error) {
    console.error('Error fetching families:', error);
    return [];
  }

  return (data as FamilyItem[]) || [];
});

// 4. Cached Reviews
export type GetReviewsParams = {
  marque: string;
  famille?: string;
  my?: string; // stored as number in DB usually, but passed as string in params sometimes. Let's use string to match page props or number?
               // The DB has MY as number. The page props has my as string.
               // Let's use strict types for the query function.
  modele?: string;
  powertrain?: string; // This usually requires parsing into Type and Puissance
  // Wait, for powertrain page, the query is complex:
  // .eq('Type', realType).eq('Puissance', power).ilike('Transmission', slugTrans)
  // To make this generic, we might need a flexible params object or specific functions.

  // Let's look at the usage:
  // FamilyPage: eq(Marque), eq(Famille)
  // MYPage: eq(Marque), eq(Famille), eq(MY)
  // ModelePage: eq(Marque), eq(Famille), eq(MY), eq(Modele)
  // PowertrainPage: eq(Marque), eq(Famille), eq(MY), eq(Modele), eq(Type), eq(Puissance), ilike(Transmission)
};

// Since PowertrainPage has specific logic to parse the slug into Type/Power/Transmission,
// and that logic happens in the page component BEFORE the query,
// we should probably pass the resolved values to getReviews.

export type ReviewFilters = {
  marque: string;
  famille?: string;
  my?: number;
  modele?: string;
  type?: string;
  puissance?: number;
  transmission?: string; // For ilike
};

export const getReviews = cache(async (filters: ReviewFilters) => {
  let query = supabase
    .from('reviews')
    .select('*')
    .eq('Marque', filters.marque);

  if (filters.famille) {
    query = query.eq('Famille', filters.famille);
  }

  if (filters.my) {
    query = query.eq('MY', filters.my);
  }

  if (filters.modele) {
    query = query.eq('Modele', filters.modele);
  }

  if (filters.type) {
    query = query.eq('Type', filters.type);
  }

  if (filters.puissance) {
    query = query.eq('Puissance', filters.puissance);
  }

  if (filters.transmission) {
    query = query.ilike('Transmission', filters.transmission);
  }

  // Common ordering
  query = query.order('Test_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }

  return (data as Review[]) || [];
});
