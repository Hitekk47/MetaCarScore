import { notFound } from "next/navigation";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from "next";
import { serializeJsonLd } from "@/lib/utils";
import { getFullContext, getReviews } from "@/lib/queries";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string; modele: string }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille, my, modele } = await params;  

  // Utilisation du cache partagé
  const context = await getFullContext({
    p_marque_slug: marque,
    p_famille_slug: famille,
    p_my: parseInt(my),
    p_modele_slug: modele
  });

  if (!context?.real_marque || !context?.real_modele) {
    notFound();
  }

  const displayMarque = context.real_marque;
  const displayModele = context.real_modele;

  const title = `${displayMarque} ${displayModele} (${my}) : Avis, Score & Essais`;
  const description = `Quelle note pour la ${displayMarque} ${displayModele} ${my} ? Consultez l'agrégation de tous les essais presse sur MetaCarScore.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${marque}/${famille}/${my}/${modele}`,
    },
    openGraph: {
      title,
      description,
    }
  };
}

export default async function ModelePage({ params }: PageProps) {
  // 2. Décodage des Slugs
  const { marque: sMarque, famille: sFamille, my, modele: sModele } = await params;

  // Utilisation du cache partagé
  const context = await getFullContext({
    p_marque_slug: sMarque,
    p_famille_slug: sFamille,
    p_my: parseInt(my),
    p_modele_slug: sModele
  });

  if (!context?.real_marque) return notFound(); // Utilisation de notFound() standard
  const realMarque = context.real_marque;

  if (!context?.real_famille) return notFound();
  const realFamille = context.real_famille;

  if (!context?.real_modele) return notFound();
  const realModele = context.real_modele;

  // 3. Récupération des données (avec cache)
  const reviews = await getReviews({
    marque: realMarque,
    famille: realFamille,
    my: parseInt(my),
    modele: realModele
  });

  if (!reviews || reviews.length === 0) {
    notFound();
  }

  // On calcule la moyenne côté serveur pour Google
  const totalScore = reviews.reduce((acc, r) => acc + r.Score, 0);
  const avgScore = Math.round(totalScore / reviews.length);
  // -----------------------------------------

  // 4. Construction du JSON-LD avec la variable avgScore calculée juste au-dessus
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${realMarque} ${realModele} (${my})`,
    brand: {
      '@type': 'Brand',
      name: realMarque,
    },
    model: realModele,
    productionDate: my,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avgScore,
      bestRating: "100",
      worstRating: "0",
      ratingCount: reviews.length,
    },
    review: reviews.slice(0, 5).map(r => ({
        '@type': 'Review',
        author: { '@type': 'Organization', name: r.Testeur },
        datePublished: r.Test_date,
        reviewRating: { '@type': 'Rating', ratingValue: r.Score, bestRating: "100", worstRating: "0" },
    }))
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
        modele={realModele}
        level="modele" 
      />
    </>
  );
}