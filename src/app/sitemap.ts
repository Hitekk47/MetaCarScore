import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { toSlug } from '@/lib/slugify';
import { TOPS_MENU } from '@/lib/constants';

const BASE_URL = 'https://metacarscore.vercel.app';

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

  // 3. Récupération des données (Optimisée pour Sitemap)

  const { data: rows } = await supabase
    .from('reviews')
    .select('Marque, Famille, MY, Modele')
    .not('Famille', 'is', null)
    .not('Modele', 'is', null);

  // --- DÉDOUBLONNAGE INTELLIGENT ---

  const brands = new Set<string>();
  const families = new Set<string>();
  const mys = new Set<string>();
  const models = new Set<string>();

  rows?.forEach((row) => {
    const m = toSlug(row.Marque);
    const f = toSlug(row.Famille);
    const y = row.MY;
    const mo = toSlug(row.Modele);

    // Niveau 1 : Marque
    brands.add(`${BASE_URL}/${m}`);

    // Niveau 2 : Famille
    families.add(`${BASE_URL}/${m}/${f}`);

    // Niveau 3 : Année (MY)
    mys.add(`${BASE_URL}/${m}/${f}/${y}`);

    // Niveau 4 : Modèle
    models.add(`${BASE_URL}/${m}/${f}/${y}/${mo}`);
  });

  // --- CONSTRUCTION DES ROUTES ---
  
  const brandRoutes = Array.from(brands).map(url => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const familyRoutes = Array.from(families).map(url => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const myRoutes = Array.from(mys).map(url => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const modelRoutes = Array.from(models).map(url => ({
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