import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { Review, ModelAlias } from '@/lib/types';
import { SeoStats } from './seo-utils';

// Types for RPC responses
export interface BrandContext {
  Marque: string;
}

export interface FullContext {
  real_marque: string | null;
  real_famille: string | null;
  real_modele: string | null;
  real_powertrain: string | null;
  is_alias?: boolean;
  alias_marque?: string | null;
  alias_famille?: string | null;
  alias_modele?: string | null;
}

export interface FamilyItem {
  famille: string;
  review_count: number;
  is_alias?: boolean;
  canonical_marque?: string;
  canonical_famille?: string;
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
  const { data, error } = await supabase.rpc('get_full_context_by_slugs_v2', params);

  if (error) {
    const fallback = await supabase.rpc('get_full_context_by_slugs', params);
    if (fallback.error) {
      console.error('Error fetching full context: An unexpected error occurred');
      return null;
    }
    return (fallback.data?.[0] as FullContext) || null;
  }

  return (data?.[0] as FullContext) || null;
});

// Helper for fetching Model Aliases
export const getAliases = cache(async (params: { canonicalMarque: string; canonicalFamille: string; my?: number; modele?: string }) => {
  const query = supabase
    .from('model_aliases')
    .select('*')
    .eq('canonical_marque', params.canonicalMarque)
    .eq('canonical_famille', params.canonicalFamille);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching aliases:', error);
    return [];
  }

  let aliases = (data as ModelAlias[]) || [];

  if (params.my !== undefined) {
    aliases = aliases.filter(a => a.canonical_my === null || a.canonical_my === params.my);
  }
  if (params.modele !== undefined) {
    aliases = aliases.filter(a => a.canonical_modele === null || a.canonical_modele === params.modele);
  }

  return aliases;
});

// 3. Cached Families List
export const getFamilies = cache(async (brandName: string) => {
  const { data, error } = await supabase.rpc('get_families_by_brand_v2', {
    brand_name: brandName
  });

  if (error) {
    const fallback = await supabase.rpc('get_families_by_brand', {
      brand_name: brandName
    });
    if (fallback.error) {
      console.error('Error fetching families: An unexpected error occurred');
      return [];
    }
    return (fallback.data as FamilyItem[]) || [];
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
  // Fetch matching aliases for the vehicle
  const aliases = filters.famille ? await getAliases({
    canonicalMarque: filters.marque,
    canonicalFamille: filters.famille,
    my: filters.my,
    modele: filters.modele
  }) : [];

  let query = supabase.from('reviews').select('*');

  if (aliases.length === 0) {
    query = query.eq('Marque', filters.marque);
    if (filters.famille) query = query.eq('Famille', filters.famille);
    if (filters.my) query = query.eq('MY', filters.my);
    if (filters.modele) query = query.eq('Modele', filters.modele);
  } else {
    const canonicalCond = `and(Marque.eq."${filters.marque}",Famille.eq."${filters.famille}"${filters.my ? `,MY.eq.${filters.my}` : ''}${filters.modele ? `,Modele.eq."${filters.modele}"` : ''})`;
    const aliasConds = aliases.map(a => {
      let cond = `and(Marque.eq."${a.alias_marque}",Famille.eq."${a.alias_famille}"`;
      if (filters.my) cond += `,MY.eq.${filters.my}`;
      if (a.alias_modele) {
        cond += `,Modele.eq."${a.alias_modele}"`;
      } else if (filters.modele) {
        cond += `,Modele.eq."${filters.modele}"`;
      }
      cond += ')';
      return cond;
    });

    query = query.or([canonicalCond, ...aliasConds].join(','));
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
  const { data, error } = await supabase.rpc('get_vehicle_seo_stats_v2', params);

  if (error) {
    const fallback = await supabase.rpc('get_vehicle_seo_stats', params);
    if (fallback.error) {
      console.error('Error fetching vehicle SEO stats:', fallback.error);
      return null;
    }
    return fallback.data as SeoStats | null;
  }

  return data as SeoStats | null;
});
