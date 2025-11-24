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
  const { marque, famille, my, modele, powertrain } = await params;
  
  const decodedMarque = decodeURIComponent(marque);
  const decodedFamille = decodeURIComponent(famille);
  const decodedModele = decodeURIComponent(modele);
  const decodedPowertrain = decodeURIComponent(powertrain);

  // DÉCODAGE DU SLUG POWERTRAIN
  // Format attendu : TYPE_PUISSANCE_TRANSMISSION (ex: "Hybride essence_225_8A")
  const parts = decodedPowertrain.split('_');
  
  // Sécurité basique : il faut au moins 3 morceaux
  if (parts.length < 3) return notFound();

  // On récupère la transmission (dernier élément) et la puissance (avant-dernier)
  const transmission = parts.pop()!; 
  const puissanceStr = parts.pop()!;
  const puissance = parseInt(puissanceStr);
  // Le reste, c'est le type (qui peut contenir des espaces ou tirets)
  const type = parts.join('_'); 

  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .ilike('Marque', decodedMarque)
    .ilike('Famille', decodedFamille)
    .eq('MY', my)
    .ilike('Modele', decodedModele)
    // FILTRES SPÉCIFIQUES POWERTRAIN
    .eq('Type', type)
    .eq('Puissance', puissance)
    .eq('Transmission', transmission)
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) notFound();

  return (
    <GenericPageClient 
      initialReviews={rawData as Review[]} 
      marque={decodedMarque} 
      famille={decodedFamille}
      my={my}
      modele={decodedModele}
      powertrain={decodedPowertrain}
      level="powertrain" 
    />
  );
}