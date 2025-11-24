import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string; modele: string }>;
};

export default async function ModelePage({ params }: PageProps) {
  const { marque, famille, my, modele } = await params;
  const decodedMarque = decodeURIComponent(marque);
  const decodedFamille = decodeURIComponent(famille);
  const decodedModele = decodeURIComponent(modele);

  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .ilike('Marque', decodedMarque)
    .ilike('Famille', decodedFamille)
    .eq('MY', my)
    .ilike('Modele', decodedModele) // Filtre strict sur le modèle
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) notFound();

  return (
    <GenericPageClient 
      initialReviews={rawData as Review[]} 
      marque={decodedMarque} 
      famille={decodedFamille}
      my={my}
      modele={decodedModele}
      level="modele" // Le podium disparaîtra
    />
  );
}