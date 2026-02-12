import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";
import { supabase } from "@/lib/supabase";
import { toSlug } from "@/lib/slugify";

export const revalidate = 3600; // Cache 1h

export const metadata = {
  title: "Marques Automobiles : Avis, Scores & Essais",
  description: "Accédez à l'index complet de tous les constructeurs automobiles. Consultez les scores de agrégés de la presse et les avis experts pour chaque marque sur MetaCarScore.",
};

export default async function MarquesPage() {

  const { data } = await supabase.rpc('get_brand_ranking_v3', { 
    min_my: null,
    min_count: 1
  });

  // Transformation des données pour le composant générique
  const items: DirectoryItem[] = (data || []).map((brand: any) => ({
    id: brand.brand,
    title: brand.brand,
    subtitle: `${brand.review_count} Essai${brand.review_count > 1 ? 's' : ''}`,
    
    href: `/${toSlug(brand.brand)}`, 
    
    letter: brand.brand.charAt(0),
  })).sort((a: any, b: any) => a.title.localeCompare(b.title));

  return (
    <GenericDirectoryClient 
      title="Marques" 
      subtitle="Accédez à l'intégralité des constructeurs référencés sur MetaCarScore."
      items={items}
      placeholderSearch="Filtrer une marque..."
    />
  );
}