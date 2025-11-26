import { notFound } from "next/navigation";
import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";
import { supabase } from "@/lib/supabase";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { marque } = await params;
  const decodedMarque = decodeURIComponent(marque);
  return {
    title: `Tous les modèles ${decodedMarque} | MetaCarScore`,
    description: `Découvrez la gamme ${decodedMarque} : essais, fiches techniques et scores de fiabilité.`,
  };
}

export default async function BrandPage({ params }: PageProps) {
  const { marque } = await params;
  const decodedMarque = decodeURIComponent(marque);

  // Appel de la fonction SQL (Version avec min_my et max_my)
  const { data, error } = await supabase.rpc('get_families_by_brand', { brand_name: decodedMarque });

  if (error || !data || data.length === 0) {
    notFound();
  }

  // Transformation pour le composant générique
  const items: DirectoryItem[] = data.map((item: any) => ({
    id: item.famille,
    title: item.famille,
    
    // RETOUR À LA VERSION PRÉCÉDENTE : Nombre d'essais
    subtitle: `${item.review_count} Essais`,
    
    // ON SUPPRIME LA LIGNE subtitleIconName
    
    href: `/${decodedMarque}/${item.famille}`,
    iconName: "layers",
    colorClass: "bg-slate-50 text-slate-700 border-slate-200"
  }));

  return (
    <GenericDirectoryClient 
      title={decodedMarque}
      subtitle={`Découvrez les ${data.length} gammes de véhicules ${decodedMarque} analysées par nos experts.`}
      items={items}
      placeholderSearch={`Filtrer la gamme ${decodedMarque}...`}
    />
  );
}