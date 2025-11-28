import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types"; 
import GenericPageClient from "@/components/pages/GenericPageClient";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string; modele: string }>;
};

export default async function ModelePage({ params }: PageProps) {
  // 1. Récupération des slugs (URL)
  const { marque: sMarque, famille: sFamille, my, modele: sModele } = await params;

  // 2. Décodage en cascade (Waterfall)
  // A. Vraie Marque
  const { data: dMarque } = await supabase.rpc('find_brand_by_slug', { slug_input: sMarque });
  const realMarque = dMarque?.[0]?.Marque;
  if (!realMarque) return <div>Marque introuvable</div>; // Ou notFound()

  // B. Vraie Famille
  const { data: dFamille } = await supabase.rpc('find_family_by_slug', { 
    real_brand_name: realMarque, 
    family_slug: sFamille 
  });
  const realFamille = dFamille?.[0]?.Famille;
  if (!realFamille) return <div>Famille introuvable</div>;

  // C. Vrai Modèle
  const { data: dModele } = await supabase.rpc('find_model_by_slug', {
    real_brand_name: realMarque,
    real_family_name: realFamille,
    target_my: parseInt(my),
    model_slug: sModele
  });
  const realModele = dModele?.[0]?.Modele;
  if (!realModele) return <div>Modèle introuvable</div>;

  // 3. Chargement des reviews avec les "Vrais Noms" de la BDD
  const { data: rawData, error } = await supabase
     .from('reviews')
     .select('*')
     .eq('Marque', realMarque)
     .eq('Famille', realFamille)
     .eq('MY', my)
     .eq('Modele', realModele)
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
      modele={realModele}
      level="modele" 
    />
  );
}
