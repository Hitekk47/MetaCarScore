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
  // 2. Décodage Slugs (Marque/Famille/Modele/Powertrain)
  const { marque: sMarque, famille: sFamille, my, modele: sModele, powertrain: sPowertrain } = await params;

  // 1. Décodage synchrone du powertrain (Côté serveur Next.js, immédiat)
  const parts = sPowertrain.split('_');
  if (parts.length < 3) return notFound();
  const slugTrans = parts.pop()!;
  const powerStr = parts.pop()!;
  const slugType = parts.join('_');

  // 2. Appel RPC unique regroupant TOUT le contexte
  const { data: contextData } = await supabase.rpc('get_full_context_by_slugs', {
    p_marque_slug: sMarque,
    p_famille_slug: sFamille,
    p_my: parseInt(my, 10),
    p_modele_slug: sModele,
    p_powertrain_slug: slugType
  });
  
  const context = contextData?.[0];

  // 3. Vérifications
  if (!context?.real_marque) return notFound();
  const realMarque = context.real_marque;

  if (!context?.real_famille) return notFound();
  const realFamille = context.real_famille;

  if (!context?.real_modele) return notFound();
  const realModele = context.real_modele;

  if (!context?.real_powertrain) return notFound();
  const realType = context.real_powertrain;

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