import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types"; 
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from "next";
import { serializeJsonLd } from "@/lib/utils";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string; modele: string }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille, my, modele } = await params;  
  const { data } = await supabase
    .from('reviews')
    .select('Marque, Modele')
    .eq('MY', parseInt(my))
    .ilike('Marque', marque) 
    .ilike('Modele', modele.replace(/-/g, ' '))
    .limit(1)
    .single();

  // Fallback si la DB ne répond pas vite ou pas de match exact
  const displayMarque = data?.Marque || marque.toUpperCase();
  const displayModele = data?.Modele || modele;

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

  const { data: contextData, error: contextError } = await supabase.rpc('get_full_context_by_slugs', {
    p_marque_slug: sMarque,
    p_famille_slug: sFamille,
    p_my: parseInt(my),
    p_modele_slug: sModele
  });

  // Récupération de la première ligne de résultat
  const context = contextData?.[0];

  if (contextError || !context) {
    // Gestion d'erreur générique si l'appel RPC échoue
    console.error("Erreur contexte", contextError);
    return <div>Erreur de chargement du contexte</div>;
  }

  // Vérifications progressives comme dans votre code original
  if (!context.real_marque) return <div>Marque introuvable</div>;
  const realMarque = context.real_marque;

  if (!context.real_famille) return <div>Famille introuvable</div>;
  const realFamille = context.real_famille;

  if (!context.real_modele) return <div>Modèle introuvable</div>;
  const realModele = context.real_modele;

  // 3. Récupération des données
  const { data: rawData, error } = await supabase
     .from('reviews')
     .select('*')
     .eq('Marque', realMarque)
     .eq('Famille', realFamille)
     .eq('MY', my)
     .eq('Modele', realModele)
     .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) {
    notFound();
  }

  const reviews = rawData as Review[];

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