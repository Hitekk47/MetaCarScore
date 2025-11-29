import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types"; 
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from "next"; 

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string; famille: string; my: string; modele: string }>;
};

// 1. METADATA (Canonical URL)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille, my, modele } = await params;
  return {
    alternates: {
      canonical: `https://metacarscore.vercel.app${marque}/${famille}/${my}/${modele}`,
    },
  };
}

export default async function ModelePage({ params }: PageProps) {
  // 2. Décodage des Slugs (Identique à avant)
  const { marque: sMarque, famille: sFamille, my, modele: sModele } = await params;

  const { data: dMarque } = await supabase.rpc('find_brand_by_slug', { slug_input: sMarque });
  const realMarque = dMarque?.[0]?.Marque;
  if (!realMarque) return <div>Marque introuvable</div>; 

  const { data: dFamille } = await supabase.rpc('find_family_by_slug', { real_brand_name: realMarque, family_slug: sFamille });
  const realFamille = dFamille?.[0]?.Famille;
  if (!realFamille) return <div>Famille introuvable</div>;

  const { data: dModele } = await supabase.rpc('find_model_by_slug', { real_brand_name: realMarque, real_family_name: realFamille, target_my: parseInt(my), model_slug: sModele });
  const realModele = dModele?.[0]?.Modele;
  if (!realModele) return <div>Modèle introuvable</div>;

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
        author: { '@type': 'Person', name: r.Testeur },
        datePublished: r.Test_date,
        reviewRating: { '@type': 'Rating', ratingValue: r.Score, bestRating: "100", worstRating: "0" },
    }))
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
        modele={realModele}
        level="modele" 
      />
    </>
  );
}