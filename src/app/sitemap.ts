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

  // 3. Récupération des données brute pour calcul des scores
  // On récupère toutes les lignes (20k+) par vagues pour calculer les counts par groupe
  // car on ne veut indexer que les pages avec >= 3 essais.
  // PostgREST limite souvent à 1000 lignes par requête.
  const allRows: ReviewRow[] = [];
  let from = 0;
  const step = 5000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('reviews')
      .select('Marque, Famille, MY, Modele')
      .range(from, from + step - 1);

    if (error) {
      console.error('Error fetching reviews for sitemap:', error.message);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...(data as ReviewRow[]));
      from += step;
      if (data.length < step) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  // --- CALCUL DES COMPTEURS ET DÉDOUBLONNAGE ---

  const brands = new Set<string>();
  const familyCounts = new Map<string, number>();
  const myCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();

  if (allRows.length > 0) {
    allRows.forEach((row: ReviewRow) => {
      const m = toSlug(row.Marque);
      const f = toSlug(row.Famille);
      const y = row.MY;
      const mo = toSlug(row.Modele);

      const brandPath = `${BASE_URL}/${m}`;
      const familyPath = `${BASE_URL}/${m}/${f}`;
      const myPath = `${BASE_URL}/${m}/${f}/${y}`;
      const modelPath = `${BASE_URL}/${m}/${f}/${y}/${mo}`;

      // Niveau 1 : Marque (Toujours incluse si elle a au moins 1 essai)
      brands.add(brandPath);

      // Niveau 2 : Famille
      familyCounts.set(familyPath, (familyCounts.get(familyPath) || 0) + 1);

      // Niveau 3 : Année (MY)
      myCounts.set(myPath, (myCounts.get(myPath) || 0) + 1);

      // Niveau 4 : Modèle
      modelCounts.set(modelPath, (modelCounts.get(modelPath) || 0) + 1);
    });
  }

  // --- FILTRAGE ---

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

  const modelRoutes = Array.from(modelCounts.entries())
    .filter(([_, count]) => count >= 3)
    .map(([url]) => ({
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