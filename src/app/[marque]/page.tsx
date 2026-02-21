import { notFound } from "next/navigation";
import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";
import { toSlug } from "@/lib/slugify";
import { Metadata } from 'next';
import { getBrandContext, getFamilies } from "@/lib/queries";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ marque: string }>;
};

// 1. Generate Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque } = await params;

  // Utilisation du cache partagé
  const context = await getBrandContext(marque);

  // Si la marque n'existe pas, on renvoie une 404 dès les métadonnées
  if (!context) {
    notFound();
  }

  const displayMarque = context.Marque;

  const title = `Tous les modèles ${displayMarque} : Avis, Score & Essais`;
  const description = `Découvrez la gamme ${displayMarque}. Consultez tous les modèles et l'agrégation de tous les essais presse sur MetaCarScore.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${marque}`,
    },
    openGraph: {
      title,
      description,
    }
  };
}

// --- COMPOSANT PAGE ---
export default async function BrandPage({ params }: PageProps) {
  const { marque } = await params;

  // -----------------------------------------------------------
  // 1. GATEKEEPER : On traduit le slug en vrai nom
  // -----------------------------------------------------------
  // Utilisation du cache partagé (même appel que metadata -> instantané)
  const context = await getBrandContext(marque);

  if (!context) {
    notFound();
  }

  const realMarque = context.Marque;

  // -----------------------------------------------------------
  // 2. RÉCUPÉRATION DES DONNÉES (Avec le VRAI NOM)
  // -----------------------------------------------------------
  // Utilisation du cache partagé
  const families = await getFamilies(realMarque);

  if (!families || families.length === 0) {
    // Si la marque existe mais n'a pas de familles (peu probable), on peut aussi 404
    notFound();
  }

  // -----------------------------------------------------------
  // 3. TRANSFORMATION (Avec slugification des liens)
  // -----------------------------------------------------------
  const items: DirectoryItem[] = families.map((item) => ({
    id: item.famille,
    title: item.famille,
    subtitle: `${item.review_count} Essai${item.review_count > 1 ? 's' : ''}`,
    
    // IMPORTANT : On slugifie les deux parties de l'URL sortante
    href: `/${toSlug(realMarque)}/${toSlug(item.famille)}`,
    
    iconName: "layers",
    colorClass: "bg-slate-50 text-slate-700 border-slate-200"
  }));

  return (
    <GenericDirectoryClient 
      title={realMarque} // On affiche le beau nom ("Land Rover")
      subtitle={`Découvrez les ${families.length} gammes de véhicules ${realMarque} analysées par des experts.`}
      items={items}
      placeholderSearch={`Filtrer la gamme ${realMarque}...`}
    />
  );
}