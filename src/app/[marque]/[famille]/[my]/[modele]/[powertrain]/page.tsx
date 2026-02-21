import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from 'next';
import { serializeJsonLd } from "@/lib/utils";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{
    marque: string;
    famille: string;
    my: string;
    modele: string;
    powertrain: string;
  }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque, famille, my, modele, powertrain } = await params;  
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
const displayPowertrain = powertrain.replace(/[-_]/g, ' ').split(' ').map((w, i, a) => i === a.length - 2 ? w + " ch" : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const title = `${displayMarque} ${displayModele} (${my}) en ${powertrain}: Avis, Score & Essais`;

  return {
    // TITRE PROPRE POUR L'UTILISATEUR (ONGLET)
    title: `${displayMarque} ${displayModele} (${my}) - ${displayPowertrain}`,
    
    // SEO : BLOCAGE TOTAL
    robots: {
      index: false, 
      follow: true, 
    },
  };
}


export default async function PowertrainPage({ params }: PageProps) {
  // 2. Décodage Slugs (Marque/Famille/Modele)
  const { marque: sMarque, famille: sFamille, my, modele: sModele, powertrain: sPowertrain } = await params;

  const { data: dMarque } = await supabase.rpc('find_brand_by_slug', { slug_input: sMarque });
  const realMarque = dMarque?.[0]?.Marque;
  if (!realMarque) return notFound();

  const { data: dFamille } = await supabase.rpc('find_family_by_slug', { real_brand_name: realMarque, family_slug: sFamille });
  const realFamille = dFamille?.[0]?.Famille;
  if (!realFamille) return notFound();

  const { data: dModele } = await supabase.rpc('find_model_by_slug', {
    real_brand_name: realMarque,
    real_family_name: realFamille,
    target_my: parseInt(my, 10),
    model_slug: sModele
  });
  const realModele = dModele?.[0]?.Modele;
  if (!realModele) return notFound();

  // 3. Décodage Powertrain
  const parts = sPowertrain.split('_');
  if (parts.length < 3) return notFound();
  const slugTrans = parts.pop()!;
  const powerStr = parts.pop()!;
  const slugType = parts.join('_');

  const { data: dType } = await supabase.rpc('find_type_by_slug', { type_slug: slugType });
  const realType = dType?.[0]?.Type;
  if (!realType) return notFound(); // Message erreur remplacé par notFound pour le SEO

  // 4. Chargement Data
  const { data: rawData, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('Marque', realMarque)
    .eq('Famille', realFamille)
    .eq('MY', my)
    .eq('Modele', realModele)
    .eq('Type', realType)
    .eq('Puissance', parseInt(powerStr, 10))
    .ilike('Transmission', slugTrans)
    .order('Test_date', { ascending: false });

  if (error || !rawData || rawData.length === 0) notFound();

  const reviews = rawData as Review[];

  // 5. Calcul Score & JSON-LD
  const totalScore = reviews.reduce((acc, r) => acc + r.Score, 0);
  const avgScore = Math.round(totalScore / reviews.length);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${realMarque} ${realModele} ${realType} ${powerStr}ch (${my})`,
    brand: { '@type': 'Brand', name: realMarque },
    model: realModele,
    productionDate: my,
    vehicleEngine: {
        '@type': 'EngineSpecification',
        name: `${powerStr} ch ${realType}`
    },
    vehicleTransmission: slugTrans.toUpperCase(), // ex: "7A"
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avgScore,
      bestRating: "100",
      worstRating: "0",
      ratingCount: reviews.length,
    }
  };

  // 6. Rendu
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
        powertrain={sPowertrain} // On passe le slug original
        powertrainName={realType}
        level="powertrain"
      />
    </>
  );
}