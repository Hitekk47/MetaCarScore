import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { Review } from '@/lib/types';
import { SeoStats } from './seo-utils';
import { escapePostgrestValue } from './validation';

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
  famille?: string;
  Famille?: string;
  review_count: number;
  is_alias?: boolean;
  canonical_marque?: string | null;
  canonical_famille?: string | null;
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
  const { data, error } = await supabase.rpc('find_brand_by_slug_v2', {
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
    console.error('Error fetching families:', error);
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

export interface ModelAlias {
  canonical_marque: string;
  canonical_famille: string;
  canonical_modele: string | null;
  canonical_my: number | null;
  alias_marque: string;
  alias_famille: string;
  alias_modele: string | null;
}

export const getReviews = cache(async (filters: ReviewFilters) => {
  // 1. Fetch relevant aliases bidirectionally from `model_aliases`
  let aliasQuery = supabase
    .from('model_aliases')
    .select('canonical_marque, canonical_famille, canonical_modele, canonical_my, alias_marque, alias_famille, alias_modele');

  if (filters.famille) {
    const escapedMarque = escapePostgrestValue(filters.marque);
    const escapedFamille = escapePostgrestValue(filters.famille);

    aliasQuery = aliasQuery.or(
      `and(canonical_marque.eq."${escapedMarque}",canonical_famille.eq."${escapedFamille}"),and(alias_marque.eq."${escapedMarque}",alias_famille.eq."${escapedFamille}")`
    );
  } else {
    const escapedMarque = escapePostgrestValue(filters.marque);
    aliasQuery = aliasQuery.or(
      `canonical_marque.eq."${escapedMarque}",alias_marque.eq."${escapedMarque}"`
    );
  }

  const { data: aliasData, error: aliasError } = await aliasQuery;

  if (aliasError) {
    console.error('Error fetching model aliases:', aliasError);
  }

  const aliases = (aliasData as ModelAlias[] | null) || [];

  // Filter aliases by MY if filters.my is specified
  const matchingAliases = aliases.filter((alias) => {
    if (filters.my && alias.canonical_my !== null && alias.canonical_my !== filters.my) {
      return false;
    }
    return true;
  });

  // Collect vehicle identities (Marque, Famille, and optional Modele)
  // Standard queried entity:
  const targetEntities: Array<{ marque: string; famille?: string; modele?: string }> = [
    {
      marque: filters.marque,
      famille: filters.famille,
      modele: filters.modele,
    },
  ];

  for (const alias of matchingAliases) {
    const isTargetCanonical =
      alias.canonical_marque.toLowerCase() === filters.marque.toLowerCase() &&
      (!filters.famille || alias.canonical_famille.toLowerCase() === filters.famille.toLowerCase());

    if (isTargetCanonical) {
      // Add alias entity
      targetEntities.push({
        marque: alias.alias_marque,
        famille: alias.alias_famille,
        modele: alias.alias_modele || undefined,
      });
    } else {
      // Input matched as alias, add canonical entity
      targetEntities.push({
        marque: alias.canonical_marque,
        famille: alias.canonical_famille,
        modele: alias.canonical_modele || undefined,
      });
    }
  }

  // Deduplicate target entities by marque + famille + modele
  const uniqueEntitiesMap = new Map<string, { marque: string; famille?: string; modele?: string }>();
  for (const entity of targetEntities) {
    const key = `${entity.marque.toLowerCase()}|${(entity.famille || '').toLowerCase()}|${(entity.modele || '').toLowerCase()}`;
    if (!uniqueEntitiesMap.has(key)) {
      uniqueEntitiesMap.set(key, entity);
    }
  }
  const uniqueEntities = Array.from(uniqueEntitiesMap.values());

  // 2. Build PostgREST `.or(...)` filter
  const orConditions = uniqueEntities.map((entity) => {
    const conds = [`Marque.eq."${escapePostgrestValue(entity.marque)}"`];
    if (entity.famille) {
      conds.push(`Famille.eq."${escapePostgrestValue(entity.famille)}"`);
    }
    if (entity.modele) {
      conds.push(`Modele.eq."${escapePostgrestValue(entity.modele)}"`);
    }
    return `and(${conds.join(',')})`;
  });

  let query = supabase.from('reviews').select('*').or(orConditions.join(','));

  // 3. Secondary filters
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
    console.error('Error fetching reviews: An unexpected error occurred');
    return [];
  }

  return (data as Review[]) || [];
});

export const getVehicleSeoStats = cache(async (params: { p_marque: string; p_famille: string; p_my?: number; p_modele?: string }) => {
  const { data, error } = await supabase.rpc('get_vehicle_seo_stats_v2', params);

  if (error) {
    console.error('Error fetching vehicle SEO stats:', error);
    return null;
  }

  return data as SeoStats | null;
});

export type GetModelAliasesParams = {
  marque: string;
  famille: string;
  my?: number;
  modele?: string;
};

export const getModelAliases = cache(async (params: GetModelAliasesParams): Promise<ModelAlias[]> => {
  const escapedMarque = escapePostgrestValue(params.marque);
  const escapedFamille = escapePostgrestValue(params.famille);

  const { data, error } = await supabase
    .from('model_aliases')
    .select('canonical_marque, canonical_famille, canonical_modele, canonical_my, alias_marque, alias_famille, alias_modele')
    .or(
      `and(canonical_marque.eq."${escapedMarque}",canonical_famille.eq."${escapedFamille}"),and(alias_marque.eq."${escapedMarque}",alias_famille.eq."${escapedFamille}")`
    );

  if (error) {
    console.error('Error fetching model aliases:', error);
    return [];
  }

  const aliases = (data as ModelAlias[] | null) || [];

  return aliases.filter((alias) => {
    if (params.my && alias.canonical_my !== null && alias.canonical_my !== params.my) {
      return false;
    }
    if (params.modele) {
      const lowerModele = params.modele.toLowerCase();
      const matchCanonical = alias.canonical_modele === null || alias.canonical_modele.toLowerCase() === lowerModele;
      const matchAlias = alias.alias_modele === null || alias.alias_modele.toLowerCase() === lowerModele;
      if (!matchCanonical && !matchAlias) {
        return false;
      }
    }
    return true;
  });
});
