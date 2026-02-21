import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { toSlug } from '@/lib/slugify';
import { TOPS_MENU } from '@/lib/constants';

const BASE_URL = 'https://metacarscore.com';

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

  // 3. Récupération des données (Optimisée via RPC)

  // On utilise une fonction RPC pour récupérer uniquement les combinaisons distinctes
  // ce qui réduit drastiquement la bande passante et l'usage mémoire.
  const { data: rows, error } = await supabase.rpc('get_sitemap_data');

  if (error) {
    console.error('Error fetching sitemap data via RPC:', error);
    // En cas d'erreur, on retourne uniquement les routes statiques
  }

  // --- DÉDOUBLONNAGE INTELLIGENT ---

  const brands = new Set<string>();
  const families = new Set<string>();
  const mys = new Set<string>();
  const models = new Set<string>();

  if (rows && Array.isArray(rows)) {
    rows.forEach((row: any) => {
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
  }

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