import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from 'next';
import { serializeJsonLd } from "@/lib/utils";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille } = await params;
  const { data } = await supabase
    .from('reviews')
    .select('Marque, Famille')
    .ilike('Marque', marque)
    .ilike('Famille', famille.replace(/-/g, ' '))
    .limit(1)
    .single();

  // Fallback si la DB ne répond pas vite ou pas de match exact
  const displayMarque = data?.Marque || marque.toUpperCase();
  const displayFamille = data?.Famille || famille;

  const title = `${displayMarque} ${displayFamille} : Avis, Score & Essais`;
  const description = `Découvrez l'historique de la gamme ${displayMarque} ${displayFamille}. Consultez l'historique des générations, le comparatif des versions et l'agrégation de tous les essais presse sur MetaCarScore.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${marque}/${famille}`,
    },
    openGraph: {
      title,
      description,
    }
  };
}

export default async function FamilyPage({ params }: PageProps) {
  // 2. Décodage Slugs
  const { marque: sMarque, famille: sFamille } = await params;

  const { data: contextData } = await supabase.rpc('get_full_context_by_slugs', { 
    p_marque_slug: sMarque, 
    p_famille_slug: sFamille 
  });
  const context = contextData?.[0];

  if (!context?.real_marque) return notFound();
  const realMarque = context.real_marque;

  if (!context?.real_famille) return notFound();
  const realFamille = context.real_famille;

  // 3. Chargement Data
  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('Marque', realMarque)
    .eq('Famille', realFamille)
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) notFound();

  const reviews = rawData as Review[];

  // 4. Calcul Score & JSON-LD
  const totalScore = reviews.reduce((acc, r) => acc + r.Score, 0);
  const avgScore = Math.round(totalScore / reviews.length);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup', // Une famille de produits
    name: `${realMarque} ${realFamille}`, // ex: Porsche 911
    brand: { '@type': 'Brand', name: realMarque },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avgScore,
      bestRating: "100",
      worstRating: "0",
      reviewCount: reviews.length, // 'reviewCount' car ProductGroup
    }
  };

  // 5. Rendu
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <GenericPageClient 
        initialReviews={reviews} 
        marque={realMarque}
        famille={realFamille}
        level="family"
      />
    </>
  );
}