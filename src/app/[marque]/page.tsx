import { notFound } from "next/navigation";
import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";
import { supabase } from "@/lib/supabase";
import { toSlug } from "@/lib/slugify";
import { Metadata } from 'next';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque } = await params;

  const { data } = await supabase
    .from('reviews')
    .select('Marque')
    .ilike('Marque', marque)
    .limit(1)
    .single();

  // Fallback si la DB ne répond pas vite ou pas de match exact    
  const displayMarque = data?.Marque || marque.toUpperCase();

  const title = `Tous les modèles ${displayMarque} : Avis, Score & Essais`;
  const description = `Découvrez la gamme ${displayMarque}. Consultez tous les modèles et l'agrégation de tous les essais presse sur MetaCarScore.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${marque}`,
    },
    openGraph: {
      title,
      description,
    }
  };
}

// --- COMPOSANT PAGE ---
export default async function BrandPage({ params }: PageProps) {
  const { marque } = await params;

  // -----------------------------------------------------------
  // 1. GATEKEEPER : On traduit le slug en vrai nom
  // -----------------------------------------------------------
  // Note: On utilise le RPC 'find_brand_by_slug' que tu as ajouté dans Supabase
  const { data: brandData } = await supabase.rpc('find_brand_by_slug', { 
    slug_input: marque 
  });

  const realMarque = brandData?.[0]?.Marque;

  // Si le slug ne correspond à rien, 404 directe
  if (!realMarque) {
    notFound();
  }

  // -----------------------------------------------------------
  // 2. RÉCUPÉRATION DES DONNÉES (Avec le VRAI NOM)
  // -----------------------------------------------------------
  // On passe 'realMarque' (Land Rover) et non 'marque' (land-rover)
  const { data, error } = await supabase.rpc('get_families_by_brand', { 
    brand_name: realMarque 
  });

  if (error || !data || data.length === 0) {
    // Si la marque existe mais n'a pas de familles (peu probable), on peut aussi 404
    notFound();
  }

  // -----------------------------------------------------------
  // 3. TRANSFORMATION (Avec slugification des liens)
  // -----------------------------------------------------------
  const items: DirectoryItem[] = data.map((item: any) => ({
    id: item.famille,
    title: item.famille,
    subtitle: `${item.review_count} Essai${item.review_count > 1 ? 's' : ''}`,
    
    // IMPORTANT : On slugifie les deux parties de l'URL sortante
    href: `/${toSlug(realMarque)}/${toSlug(item.famille)}`,
    
    iconName: "layers",
    colorClass: "bg-slate-50 text-slate-700 border-slate-200"
  }));

  return (
    <GenericDirectoryClient 
      title={realMarque} // On affiche le beau nom ("Land Rover")
      subtitle={`Découvrez les ${data.length} gammes de véhicules ${realMarque} analysées par des experts.`}
      items={items}
      placeholderSearch={`Filtrer la gamme ${realMarque}...`}
    />
  );
}