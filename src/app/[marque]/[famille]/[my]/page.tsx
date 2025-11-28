import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string }>;
};

export default async function MYPage({ params }: PageProps) {
  // 1. Récupération des slugs (URL)
  const { marque: sMarque, famille: sFamille, my } = await params;

  // 2. Décodage en cascade (Waterfall) pour Marque et Famille uniquement
  
  // A. Vraie Marque
  const { data: dMarque } = await supabase.rpc('find_brand_by_slug', { slug_input: sMarque });
  const realMarque = dMarque?.[0]?.Marque;
  
  if (!realMarque) {
    // Si la marque n'existe pas, 404 direct ou message d'erreur
    return notFound(); 
  }

  // B. Vraie Famille (contexte marque requis)
  const { data: dFamille } = await supabase.rpc('find_family_by_slug', { 
    real_brand_name: realMarque, 
    family_slug: sFamille 
  });
  const realFamille = dFamille?.[0]?.Famille;
  
  if (!realFamille) {
    // Si la famille n'existe pas pour cette marque
    return notFound();
  }

  // 3. Chargement des reviews
  // On n'a pas besoin de valider "my" via RPC car c'est juste un filtre numérique
  // On utilise les vrais noms (realMarque, realFamille) pour le filtrage strict (.eq)
  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('Marque', realMarque)
    .eq('Famille', realFamille)
    .eq('MY', my) // Filtre strict sur l'année
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
      my={my}
      level="my"
    />
  );
}
