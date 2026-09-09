import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { toSlug } from '@/lib/slugify';
import { TOPS_MENU } from '@/lib/constants';

const BASE_URL = 'https://metacarscore.com';

interface ReviewRow {
  Marque: string;
  Famille: string;
  MY: number;
  Modele: string;
  Testeur: string;
}

interface SitemapGroup {
  marque: string;
  famille: string;
  my: string;
  modele: string;
  review_count: number;
}

interface ModelAliasRow {
  canonical_marque: string;
  canonical_famille: string;
  canonical_modele: string | null;
  alias_marque: string;
  alias_famille: string;
  alias_modele: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  
  // 1. Pages Statiques (Priorité 1.0)
  const baseRoutes = [
    '',
    '/marques',
    '/tops',
    '/duels',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 1.0,
  }));

  // 2. Tops (Priorité 0.9)
  const topRoutes = TOPS_MENU.map((item) => ({
    url: `${BASE_URL}${item.href}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: item.priority || 0.9,
  }));

  // 3. Récupération des données brute des essais & des alias
  const [reviewsRes, aliasesRes, modelGroupsRes] = await Promise.all([
    supabase.from('reviews').select('Marque, Famille, MY, Testeur'),
    supabase.from('model_aliases').select('canonical_marque, canonical_famille, canonical_modele, alias_marque, alias_famille, alias_modele'),
    supabase.rpc('get_sitemap_groups_filtered_v3'),
  ]);

  if (reviewsRes.error) {
    console.error('Error fetching reviews for sitemap:', reviewsRes.error.message);
  }

  const allRows = reviewsRes.data || [];
  const aliases = (aliasesRes.data || []) as ModelAliasRow[];
  const modelGroups = modelGroupsRes.data as SitemapGroup[] | null;

  // Création d'une map pour la résolution rapide d'alias
  const aliasMap = new Map<string, { canonical_marque: string; canonical_famille: string }>();
  aliases.forEach((a) => {
    const key = `${a.alias_marque.toLowerCase()}|${a.alias_famille.toLowerCase()}`;
    aliasMap.set(key, {
      canonical_marque: a.canonical_marque,
      canonical_famille: a.canonical_famille,
    });
  });

  // --- CALCUL DES COMPTEURS ET DÉDOUBLONNAGE ---

  const brands = new Set<string>();
  const familySources = new Map<string, Set<string>>();
  const mySources = new Map<string, Set<string>>();
  const modelRoutesSet = new Set<string>();

  // Modèles optimisés via RPC get_sitemap_groups_filtered_v3
  if (modelGroups && Array.isArray(modelGroups)) {
    modelGroups.forEach((row: SitemapGroup) => {
      const m = toSlug(row.marque);
      const f = toSlug(row.famille);
      const y = row.my;
      const mo = toSlug(row.modele);
      modelRoutesSet.add(`${BASE_URL}/${m}/${f}/${y}/${mo}`);
    });
  }

  // Traitement des familles & MYs avec unification canonique et comptage des sources distinctes
  allRows.forEach((row: Partial<ReviewRow>) => {
    if (!row.Marque || !row.Famille) return;

    // Ajout de la marque (catalogues 200 OK)
    brands.add(`${BASE_URL}/${toSlug(row.Marque)}`);

    // Unification sous l'identité canonique si la ligne est un alias
    const aliasKey = `${row.Marque.toLowerCase()}|${row.Famille.toLowerCase()}`;
    const aliasMatch = aliasMap.get(aliasKey);

    const canonicalMarque = aliasMatch ? aliasMatch.canonical_marque : row.Marque;
    const canonicalFamille = aliasMatch ? aliasMatch.canonical_famille : row.Famille;

    const m = toSlug(canonicalMarque);
    const f = toSlug(canonicalFamille);
    const y = row.MY;

    const familyPath = `${BASE_URL}/${m}/${f}`;
    const myPath = `${BASE_URL}/${m}/${f}/${y}`;

    const tester = row.Testeur ? row.Testeur.trim().toLowerCase() : null;
    if (tester) {
      if (!familySources.has(familyPath)) familySources.set(familyPath, new Set());
      familySources.get(familyPath)!.add(tester);

      if (!mySources.has(myPath)) mySources.set(myPath, new Set());
      mySources.get(myPath)!.add(tester);
    }
  });

  // --- CONSTRUCTION DES ROUTES FILTRÉES (>= 3 sources distinctes) ---

  const brandRoutes = Array.from(brands).map((url) => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const familyRoutes = Array.from(familySources.entries())
    .filter(([, sources]) => sources.size >= 3)
    .map(([url]) => ({
      url,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));

  const myRoutes = Array.from(mySources.entries())
    .filter(([, sources]) => sources.size >= 3)
    .map(([url]) => ({
      url,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

  const modelRoutes = Array.from(modelRoutesSet).map((url) => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [
    ...baseRoutes, 
    ...topRoutes, 
    ...brandRoutes, 
    ...familyRoutes, 
    ...myRoutes, 
    ...modelRoutes
  ];
}
