import { notFound } from "next/navigation";
import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";
import { supabase } from "@/lib/supabase";
import { toSlug } from "@/lib/slugify"; // Import indispensable pour les liens sortants

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string }>;
};

// --- METADATA DYNAMIQUE (Avec décodage) ---
export async function generateMetadata({ params }: PageProps) {
  const { marque } = await params;
  
  // 1. Décodage du slug pour le titre
  const { data } = await supabase.rpc('find_brand_by_slug', { slug_input: marque });
  const realMarque = data?.[0]?.Marque;

  if (!realMarque) return { title: 'Marque introuvable | MetaCarScore' };

  return {
    title: `Tous les modèles ${realMarque} | MetaCarScore`,
    description: `Découvrez la gamme ${realMarque} : essais, fiches techniques et scores.`,
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
    subtitle: `${item.review_count} Essais`,
    
    // IMPORTANT : On slugifie les deux parties de l'URL sortante
    href: `/${toSlug(realMarque)}/${toSlug(item.famille)}`,
    
    iconName: "layers",
    colorClass: "bg-slate-50 text-slate-700 border-slate-200"
  }));

  return (
    <GenericDirectoryClient 
      title={realMarque} // On affiche le beau nom ("Land Rover")
      subtitle={`Découvrez les ${data.length} gammes de véhicules ${realMarque} analysées par nos experts.`}
      items={items}
      placeholderSearch={`Filtrer la gamme ${realMarque}...`}
    />
  );
}