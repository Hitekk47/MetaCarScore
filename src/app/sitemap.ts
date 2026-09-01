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

interface SitemapCanonicalRoute {
  route_type: 'family' | 'my' | 'model';
  marque: string;
  famille: string;
  my: string | null;
  modele: string | null;
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

  // 3. Marques (Toutes les marques ayant des essais pour la navigation 200 OK)
  const { data: rawBrandRows, error: brandError } = await supabase
    .from('reviews')
    .select('Marque');

  if (brandError) {
    console.error('Error fetching brand rows for sitemap:', brandError.message);
  }

  const brandRoutesSet = new Set<string>();
  if (rawBrandRows && Array.isArray(rawBrandRows)) {
    rawBrandRows.forEach((row: Partial<ReviewRow>) => {
      if (row.Marque) {
        brandRoutesSet.add(`${BASE_URL}/${toSlug(row.Marque)}`);
      }
    });
  }

  const brandRoutes = Array.from(brandRoutesSet).map((url) => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // 4. Routes Canoniques (Familles, MY, Modèles avec >= 3 essais cumulés via RPC unifié)
  const { data: canonicalRoutesData, error: rpcError } = await supabase.rpc('get_sitemap_canonical_routes');

  if (rpcError) {
    console.error('Error calling get_sitemap_canonical_routes:', rpcError.message);
  }

  const familyRoutesSet = new Set<string>();
  const myRoutesSet = new Set<string>();
  const modelRoutesSet = new Set<string>();

  if (canonicalRoutesData && Array.isArray(canonicalRoutesData)) {
    canonicalRoutesData.forEach((row: SitemapCanonicalRoute) => {
      const m = toSlug(row.marque);
      const f = toSlug(row.famille);
      if (row.route_type === 'family') {
        familyRoutesSet.add(`${BASE_URL}/${m}/${f}`);
      } else if (row.route_type === 'my' && row.my) {
        myRoutesSet.add(`${BASE_URL}/${m}/${f}/${row.my}`);
      } else if (row.route_type === 'model' && row.my && row.modele) {
        const mo = toSlug(row.modele);
        modelRoutesSet.add(`${BASE_URL}/${m}/${f}/${row.my}/${mo}`);
      }
    });
  }

  const familyRoutes = Array.from(familyRoutesSet).map((url) => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const myRoutes = Array.from(myRoutesSet).map((url) => ({
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