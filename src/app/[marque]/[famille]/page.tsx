import { notFound } from "next/navigation";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from 'next';
import { serializeJsonLd } from "@/lib/utils";
import { getFullContext, getReviews, getVehicleSeoStats } from "@/lib/queries";
import { generateSeoText } from "@/lib/seo-utils";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille } = await params;

  // Utilisation du cache partagé
  const context = await getFullContext({
    p_marque_slug: marque,
    p_famille_slug: famille
  });

  if (!context?.real_marque || !context?.real_famille) {
    notFound();
  }

  const displayMarque = context.real_marque;
  const displayFamille = context.real_famille;

  const title = `${displayMarque} ${displayFamille} : Avis, Score & Essais`;
  const description = `Découvrez l'historique de la gamme ${displayMarque} ${displayFamille}. Consultez l'historique des générations, le comparatif des versions et l'agrégation de tous les essais presse sur MetaCarScore.`;

  // Récupération des reviews pour vérifier le nombre (utile pour robots noindex)
  const reviews = await getReviews({
    marque: displayMarque,
    famille: displayFamille
  });

  const shouldIndex = reviews.length >= 3;

  return {
    title,
    description,
    alternates: {
      canonical: `/${marque}/${famille}`,
    },
    robots: {
      index: shouldIndex,
      follow: true,
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

  // Utilisation du cache partagé
  const context = await getFullContext({
    p_marque_slug: sMarque, 
    p_famille_slug: sFamille 
  });

  if (!context?.real_marque) return notFound();
  const realMarque = context.real_marque;

  if (!context?.real_famille) return notFound();
  const realFamille = context.real_famille;

  // 3. Chargement Data (avec cache)
  const [reviews, seoStats] = await Promise.all([
    getReviews({
      marque: realMarque,
      famille: realFamille
    }),
    getVehicleSeoStats({
      p_marque: realMarque,
      p_famille: realFamille
    })
  ]);

  if (!reviews || reviews.length === 0) notFound();

  const seoText = seoStats ? generateSeoText(seoStats, {
    marque: realMarque,
    famille: realFamille,
    level: "family"
  }) : "";

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
        seoText={seoText}
        iqr={seoStats?.iqr}
      />
    </>
  );
}