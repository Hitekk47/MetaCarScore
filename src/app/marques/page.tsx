import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";
import { supabase } from "@/lib/supabase";
import { toSlug } from "@/lib/slugify";

export const revalidate = 3600; // Cache 1h

export const metadata = {
  title: "Marques Automobiles : Avis, Scores & Essais",
  description: "Accédez à l'index complet de tous les constructeurs automobiles. Consultez les scores agrégés de la presse et les avis experts pour chaque marque sur MetaCarScore.",
};

export default async function MarquesPage() {
  const { data, error } = await supabase.rpc('get_brand_ranking_v6', {
    min_count: 1
  });

  if (error) {
    console.error("Erreur lors de la récupération des marques :", error);
  }

  // Transformation strictement typée (Zéro erreur TypeScript TS7006)
  const items: DirectoryItem[] = (data || [])
    .map((item: any) => {
      const name = String(item.brand || item.Marque || "").trim();
      const count = Number(item.review_count || item.global_count || 0);

      if (!name) return null;

      return {
        id: name,
        title: name,
        subtitle: `${count} Essai${count > 1 ? 's' : ''}`,
        href: `/${toSlug(name)}`,
        letter: name.charAt(0).toUpperCase(),
        iconName: "Car",
        colorClass: "bg-slate-50 text-slate-700 border-slate-200",
      } as DirectoryItem;
    })
    .filter((item: DirectoryItem | null): item is DirectoryItem => item !== null)
    .sort((a: DirectoryItem, b: DirectoryItem) => a.title.localeCompare(b.title));

  return (
    <GenericDirectoryClient 
      title="Marques" 
      subtitle="Accédez à l'intégralité des constructeurs référencés sur MetaCarScore."
      items={items}
      placeholderSearch="Filtrer une marque..."
    />
  );
}