import { notFound } from "next/navigation";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from 'next';
import { serializeJsonLd } from "@/lib/utils";
import { getFullContext, getReviews, getVehicleSeoStats } from "@/lib/queries";
import { generateSeoText, cleanSeoText } from "@/lib/seo-utils";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille, my } = await params;  

  // Utilisation du cache partagé
  const context = await getFullContext({
    p_marque_slug: marque,
    p_famille_slug: famille,
  });

  if (!context?.real_marque || !context?.real_famille) {
    notFound();
  }

  const displayMarque = context.real_marque;
  const displayFamille = context.real_famille; // Ici c'est bien la famille, pas le modèle

  const title = `${displayMarque} ${displayFamille} (${my}) : Avis, Score & Essais`;

  // 1b. Data pour le SEO
  const [reviews, seoStats] = await Promise.all([
    getReviews({
      marque: displayMarque,
      famille: displayFamille,
      my: parseInt(my)
    }),
    getVehicleSeoStats({
      p_marque: displayMarque,
      p_famille: displayFamille,
      p_my: parseInt(my)
    })
  ]);

  const seoText = seoStats ? generateSeoText(seoStats, {
    marque: displayMarque,
    famille: displayFamille,
    my,
    level: "my"
  }) : "";

  const description = seoText
    ? cleanSeoText(seoText)
    : `Découvrez la gamme ${displayMarque} ${displayFamille} de ${my}. Consultez le comparatif des versions et l'agrégation de tous les essais presse sur MetaCarScore.`;

  const shouldIndex = reviews.length >= 3;

  return {
    title,
    description,
    alternates: {
      canonical: `/${marque}/${famille}/${my}`,
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

export default async function MYPage({ params }: PageProps) {
  // 2. Décodage Slugs
  const { marque: sMarque, famille: sFamille, my } = await params;

  // Utilisation du cache partagé
  const context = await getFullContext({
    p_marque_slug: sMarque, 
    p_famille_slug: sFamille,
    p_my: parseInt(my)
  });

  if (!context?.real_marque) return notFound();
  const realMarque = context.real_marque;

  if (!context?.real_famille) return notFound();
  const realFamille = context.real_famille;


  // 3. Chargement Data (avec cache)
  const [reviews, seoStats] = await Promise.all([
    getReviews({
      marque: realMarque,
      famille: realFamille,
      my: parseInt(my)
    }),
    getVehicleSeoStats({
      p_marque: realMarque,
      p_famille: realFamille,
      p_my: parseInt(my)
    })
  ]);

  if (!reviews || reviews.length === 0) notFound();

  const seoText = seoStats ? generateSeoText(seoStats, {
    marque: realMarque,
    famille: realFamille,
    my,
    level: "my"
  }) : "";

  // 4. Calcul Score & JSON-LD
  const totalScore = reviews.reduce((acc, r) => acc + r.Score, 0);
  const avgScore = Math.round(totalScore / reviews.length);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${realMarque} ${realFamille} (${my})`,
    brand: { '@type': 'Brand', name: realMarque },
    productionDate: my,
    ...(seoText ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        description: cleanSeoText(seoText),
        ratingValue: avgScore,
        bestRating: "100",
        worstRating: "0",
        ratingCount: reviews.length,
      }
    } : {})
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
        my={my}
        level="my"
        seoText={seoText}
        iqr={seoStats?.iqr}
      />
    </>
  );
}