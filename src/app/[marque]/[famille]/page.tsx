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
  // Await des params (Next.js 15)
  const resolvedParams = await params;
  const marque = decodeURIComponent(resolvedParams.marque);
  const famille = decodeURIComponent(resolvedParams.famille);

  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .ilike('Marque', marque)
    .ilike('Famille', famille)
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) {
    notFound();
  }

  return (
    <GenericPageClient 
      initialReviews={rawData as Review[]} 
      marque={marque} 
      famille={famille} 
      level="family"
    />
  );
}