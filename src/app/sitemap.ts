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
}

// Interface pour la nouvelle fonction RPC optimisée
interface SitemapGroup {
  marque: string;
  famille: string;
  my: string; // Le RPC retourne MY en string visiblement
  modele: string;
  nb_essais: number;
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

  // 3. Récupération des données brute pour calcul des scores globaux (Famille / MY)
  // On récupère toutes les lignes (20k+) pour calculer les counts par groupe
  // car on ne veut indexer que les pages avec >= 3 essais au total.
  const { data: allRows, error: fetchError } = await supabase
    .from('reviews')
    .select('Marque, Famille, MY');

  if (fetchError) {
    console.error('Error fetching reviews for sitemap:', fetchError.message);
  }

  // 4. Récupération des groupes optimisés pour les Modèles (nb_essais >= 3)
  const { data: modelGroups, error: rpcError } = await supabase.rpc('get_sitemap_groups_filtered');

  if (rpcError) {
    console.error('Error calling get_sitemap_groups_filtered:', rpcError.message);
  }

  // --- CALCUL DES COMPTEURS ET DÉDOUBLONNAGE ---

  const brands = new Set<string>();
  const familyCounts = new Map<string, number>();
  const myCounts = new Map<string, number>();
  const modelRoutesSet = new Set<string>();

  // On traite les modèles via le RPC filtré (déjà >= 3 essais)
  if (modelGroups && Array.isArray(modelGroups)) {
    modelGroups.forEach((row: SitemapGroup) => {
      const m = toSlug(row.marque);
      const f = toSlug(row.famille);
      const y = row.my;
      const mo = toSlug(row.modele);
      modelRoutesSet.add(`${BASE_URL}/${m}/${f}/${y}/${mo}`);
    });
  }

  // On traite les Familles / MY via les données brutes pour aggrégation large
  if (allRows && Array.isArray(allRows)) {
    allRows.forEach((row: Partial<ReviewRow>) => {
      const m = toSlug(row.Marque!);
      const f = toSlug(row.Famille!);
      const y = row.MY;

      const brandPath = `${BASE_URL}/${m}`;
      const familyPath = `${BASE_URL}/${m}/${f}`;
      const myPath = `${BASE_URL}/${m}/${f}/${y}`;

      brands.add(brandPath);
      familyCounts.set(familyPath, (familyCounts.get(familyPath) || 0) + 1);
      myCounts.set(myPath, (myCounts.get(myPath) || 0) + 1);
    });
  }

  // --- CONSTRUCTION DES ROUTES FILTRÉES ---

  const familyRoutes = Array.from(familyCounts.entries())
    .filter(([_, count]) => count >= 3)
    .map(([url]) => ({
      url,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));

  const myRoutes = Array.from(myCounts.entries())
    .filter(([_, count]) => count >= 3)
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

  // --- CONSTRUCTION DES ROUTES MARQUES ---

  const brandRoutes = Array.from(brands).map(url => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
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