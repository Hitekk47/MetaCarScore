import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string }>;
};

export default async function MYPage({ params }: PageProps) {
  const { marque, famille, my } = await params;
  const decodedMarque = decodeURIComponent(marque);
  const decodedFamille = decodeURIComponent(famille);

  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .ilike('Marque', decodedMarque)
    .ilike('Famille', decodedFamille)
    .eq('MY', my) // Filtre strict sur l'année
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) notFound();

  return (
    <GenericPageClient 
      initialReviews={rawData as Review[]} 
      marque={decodedMarque} 
      famille={decodedFamille}
      my={my}
      level="my" // Important
    />
  );
}