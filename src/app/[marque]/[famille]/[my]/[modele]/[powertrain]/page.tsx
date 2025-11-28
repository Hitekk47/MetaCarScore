import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{
    marque: string;
    famille: string;
    my: string;
    modele: string;
    powertrain: string;
  }>;
};

export default async function PowertrainPage({ params }: PageProps) {
  // 1. Récupération des slugs (URL)
  const { marque: sMarque, famille: sFamille, my, modele: sModele, powertrain: sPowertrain } = await params;

  // ---------------------------------------------------------
  // A. DÉCODAGE EN CASCADE (WATERFALL) - MARQUE / FAMILLE / MODÈLE
  // ---------------------------------------------------------
  
  // 1. Vraie Marque
  const { data: dMarque } = await supabase.rpc('find_brand_by_slug', { slug_input: sMarque });
  const realMarque = dMarque?.[0]?.Marque;
  if (!realMarque) return <div>Marque introuvable</div>; // ou notFound()

  // 2. Vraie Famille
  const { data: dFamille } = await supabase.rpc('find_family_by_slug', { 
    real_brand_name: realMarque, 
    family_slug: sFamille 
  });
  const realFamille = dFamille?.[0]?.Famille;
  if (!realFamille) return <div>Famille introuvable</div>;

  // 3. Vrai Modèle
  const { data: dModele } = await supabase.rpc('find_model_by_slug', {
    real_brand_name: realMarque,
    real_family_name: realFamille,
    target_my: parseInt(my, 10),
    model_slug: sModele
  });
  const realModele = dModele?.[0]?.Modele;
  if (!realModele) return <div>Modèle introuvable</div>;

  // ---------------------------------------------------------
  // B. DÉCODAGE DU SLUG POWERTRAIN
  // ---------------------------------------------------------
  // Slug attendu : "type-slug_puissance_transmission"
  // Exemple : "hybride-essence_225_8a" -> Type="hybride-essence", Power="225", Trans="8a"

  const parts = sPowertrain.split('_');
  
  // Sécurité : il faut au moins 3 segments (Type + Puissance + Transmission)
  if (parts.length < 3) return notFound();

  const slugTrans = parts.pop()!;   // ex: "8a"
  const powerStr = parts.pop()!;    // ex: "225"
  const slugType = parts.join('_'); // ex: "hybride-essence" (recolle si underscores dans le type, mais rare avec slugify)

  // ---------------------------------------------------------
  // C. VALIDATION DU TYPE MOTEUR VIA RPC
  // ---------------------------------------------------------
  const { data: dType } = await supabase.rpc('find_type_by_slug', { 
    type_slug: slugType 
  });
  const realType = dType?.[0]?.Type; // ex: "Hybride essence" (Nom officiel BDD)

  if (!realType) return <div>Type moteur introuvable</div>;

  // ---------------------------------------------------------
  // D. REQUÊTE FINALE
  // ---------------------------------------------------------
  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('Marque', realMarque)
    .eq('Famille', realFamille)
    .eq('MY', my)
    .eq('Modele', realModele)
    // Filtres Powertrain
    .eq('Type', realType)             // Nom strict (ex: "Hybride essence")
    .eq('Puissance', parseInt(powerStr, 10))
    .ilike('Transmission', slugTrans) // "8a" matchera "8A" ou "8a"
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) {
    notFound();
  }

  // ---------------------------------------------------------
  // E. RENDU
  // ---------------------------------------------------------
  return (
    <GenericPageClient 
      initialReviews={rawData as Review[]} 
      marque={realMarque}
      famille={realFamille}
      my={my}
      modele={realModele}
      level="powertrain"
    />
  );
}