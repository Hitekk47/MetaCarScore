import { notFound } from "next/navigation";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Metadata } from 'next';
import { serializeJsonLd } from "@/lib/utils";
import { getFullContext, getReviews } from "@/lib/queries";

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

  // Optimisation: On parse le powertrain pour passer le slugType au contexte
  // Cela permet d'avoir le même appel (et donc cache hit) que dans le composant Page
  const parts = powertrain.split('_');
  let slugType: string | undefined;

  if (parts.length >= 3) {
      const p = [...parts];
      p.pop(); // trans
      p.pop(); // power
      slugType = p.join('_');
  }

  // Utilisation du cache partagé avec les mêmes arguments que la page
  const context = await getFullContext({
    p_marque_slug: marque,
    p_famille_slug: famille,
    p_my: parseInt(my, 10),
    p_modele_slug: modele,
    p_powertrain_slug: slugType
  });

  if (!context?.real_marque || !context?.real_modele) {
    notFound();
  }

  const displayMarque = context.real_marque;
  const displayModele = context.real_modele;

  // Logique de formattage du powertrain pour le titre
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

  // 2. Appel RPC unique via cache
  const context = await getFullContext({
    p_marque_slug: sMarque,
    p_famille_slug: sFamille,
    p_my: parseInt(my, 10),
    p_modele_slug: sModele,
    p_powertrain_slug: slugType
  });
  
  // 3. Vérifications strictes
  if (!context?.real_marque || !context?.real_famille || !context?.real_modele || !context?.real_powertrain) {
    return notFound();
  }

  const realMarque = context.real_marque;
  const realFamille = context.real_famille;
  const realModele = context.real_modele;
  const realType = context.real_powertrain;

  // 4. Chargement Data via cache
  const reviews = await getReviews({
    marque: realMarque,
    famille: realFamille,
    my: parseInt(my),
    modele: realModele,
    type: realType,
    puissance: parseInt(powerStr, 10),
    transmission: slugTrans
  });

  if (!reviews || reviews.length === 0) notFound();

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