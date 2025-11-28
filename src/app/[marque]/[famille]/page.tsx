import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{
    marque: string;
    famille: string;
  }>;
};

export default async function FamilyPage({ params }: PageProps) {
  // 1. Récupération des slugs (URL)
  const { marque: sMarque, famille: sFamille } = await params;

  // 2. Décodage en cascade (Waterfall)
  
  // A. Vraie Marque
  const { data: dMarque } = await supabase.rpc('find_brand_by_slug', { slug_input: sMarque });
  const realMarque = dMarque?.[0]?.Marque;
  
  if (!realMarque) {
    return notFound();
  }

  // B. Vraie Famille
  const { data: dFamille } = await supabase.rpc('find_family_by_slug', { 
    real_brand_name: realMarque, 
    family_slug: sFamille 
  });
  const realFamille = dFamille?.[0]?.Famille;
  
  if (!realFamille) {
    return notFound();
  }

  // 3. Chargement des reviews
  // Utilisation des vrais noms officiels BDD pour un filtrage strict (.eq)
  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('Marque', realMarque)
    .eq('Famille', realFamille)
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) {
    notFound();
  }

  // 4. Rendu
  return (
    <GenericPageClient 
      initialReviews={rawData as Review[]} 
      marque={realMarque}
      famille={realFamille}
      level="family"
    />
  );
}
