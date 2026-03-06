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
    console.error('Error fetching brand context: An unexpected error occurred');
    return null;
  }

  return (data?.[0] as BrandContext) || null;
});

// 2. Cached Full Context (Family, Model, Powertrain)
export const getFullContext = cache(async (params: FullContextParams) => {
  const { data, error } = await supabase.rpc('get_full_context_by_slugs', params);

  if (error) {
    console.error('Error fetching full context: An unexpected error occurred');
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
    console.error('Error fetching families: An unexpected error occurred');
    return [];
  }

  return (data as FamilyItem[]) || [];
});

// 4. Cached Reviews

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
    console.error('Error fetching reviews: An unexpected error occurred');
    return [];
  }

  return (data as Review[]) || [];
});
