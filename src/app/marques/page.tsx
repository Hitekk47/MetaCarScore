import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";
import { supabase } from "@/lib/supabase";
import { toSlug } from "@/lib/slugify";

export const revalidate = 3600; // Cache 1h

export const metadata = {
  title: "Toutes les Marques | MetaCarScore",
  description: "Explorez notre catalogue de marques automobiles.",
};

export default async function MarquesPage() {
  // On utilise le RPC existant qui renvoie les marques avec assez d'essais
  // On met min_date à null pour tout avoir
  const { data } = await supabase.rpc('get_brand_ranking', { min_date: null });

  // Transformation des données pour le composant générique
  const items: DirectoryItem[] = (data || []).map((brand: any) => ({
    id: brand.brand,
    title: brand.brand,
    subtitle: `${brand.review_count} Essai${brand.review_count > 1 ? 's' : ''}`,
    
    // CORRECTION ICI : Lien direct vers la page [marque]
    // Cela ouvrira la liste des familles (Gamme)
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