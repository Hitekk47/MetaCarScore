import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from 'next';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string }>;
};

// 1. MÉTADONNÉES
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille, my } = await params;
  return {
    alternates: {
      canonical: `/${marque}/${famille}/${my}`,
    },
  };
}

export default async function MYPage({ params }: PageProps) {
  // 2. Décodage Slugs
  const { marque: sMarque, famille: sFamille, my } = await params;

  const { data: dMarque } = await supabase.rpc('find_brand_by_slug', { slug_input: sMarque });
  const realMarque = dMarque?.[0]?.Marque;
  if (!realMarque) return notFound();

  const { data: dFamille } = await supabase.rpc('find_family_by_slug', { real_brand_name: realMarque, family_slug: sFamille });
  const realFamille = dFamille?.[0]?.Famille;
  if (!realFamille) return notFound();

  // 3. Chargement Data
  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('Marque', realMarque)
    .eq('Famille', realFamille)
    .eq('MY', my)
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) notFound();

  const reviews = rawData as Review[];

  // 4. Calcul Score & JSON-LD
  const totalScore = reviews.reduce((acc, r) => acc + r.Score, 0);
  const avgScore = Math.round(totalScore / reviews.length);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${realMarque} ${realFamille} (${my})`,
    brand: { '@type': 'Brand', name: realMarque },
    productionDate: my,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avgScore,
      bestRating: "100",
      worstRating: "0",
      ratingCount: reviews.length,
    }
  };

  // 5. Rendu
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GenericPageClient 
        initialReviews={reviews} 
        marque={realMarque}
        famille={realFamille}
        my={my}
        level="my"
      />
    </>
  );
}