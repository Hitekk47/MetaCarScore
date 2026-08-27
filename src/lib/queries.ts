import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { Review, ModelAlias } from '@/lib/types';
import { SeoStats } from './seo-utils';
import { escapePostgrestValue } from '@/lib/validation';

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
  // Fetch aliases if famille is provided
  let aliases: ModelAlias[] = [];
  if (filters.famille) {
    aliases = await getModelAliases({
      marque: filters.marque,
      famille: filters.famille,
      my: filters.my,
      modele: filters.modele
    });
  }

  // Target pairs: canonical vehicle + aliases
  const targets = [
    {
      marque: filters.marque,
      famille: filters.famille,
      modele: filters.modele
    }
  ];

  if (aliases && aliases.length > 0) {
    for (const a of aliases) {
      targets.push({
        marque: a.alias_marque,
        famille: a.alias_famille,
        modele: a.alias_modele || filters.modele
      });
    }
  }

  // Build PostgREST OR conditions
  const orConditions = targets.map(t => {
    const parts = [`Marque.ilike."${escapePostgrestValue(t.marque)}"`];
    if (t.famille) {
      parts.push(`Famille.ilike."${escapePostgrestValue(t.famille)}"`);
    }
    if (t.modele) {
      parts.push(`Modele.ilike."${escapePostgrestValue(t.modele)}"`);
    }
    return `and(${parts.join(',')})`;
  });

  let query = supabase
    .from('reviews')
    .select('*')
    .or(orConditions.join(','));

  if (filters.my) {
    query = query.eq('MY', filters.my);
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

export const getVehicleSeoStats = cache(async (params: { p_marque: string; p_famille: string; p_my?: number; p_modele?: string }) => {
  const { data, error } = await supabase.rpc('get_vehicle_seo_stats_v2', {
    p_marque: params.p_marque,
    p_famille: params.p_famille,
    p_my: params.p_my ?? null,
    p_modele: params.p_modele ?? null
  });

  if (error) {
    console.error('Error fetching vehicle SEO stats:', error);
    return null;
  }

  return data as SeoStats | null;
});

export const getModelAliases = cache(async (params: { marque: string; famille: string; my?: number; modele?: string }) => {
  console.log('[getModelAliases] Params:', params);

  let query = supabase
    .from('model_aliases')
    .select('*')
    .ilike('canonical_marque', params.marque)
    .ilike('canonical_famille', params.famille);

  if (params.modele) {
    query = query.or(`canonical_modele.ilike."${params.modele}",canonical_modele.is.null`);
  }

  if (params.my) {
    query = query.or(`canonical_my.eq.${params.my},canonical_my.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getModelAliases] Error fetching model aliases:', error);
    return [];
  }

  console.log('[getModelAliases] Fetched aliases data:', data);
  return (data as ModelAlias[]) || [];
});
