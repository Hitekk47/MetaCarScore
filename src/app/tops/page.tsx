import GenericDirectoryClient, { DirectoryItem } from "@/components/pages/GenericDirectoryClient";

export const metadata = {
  title: "Tous les Classements | MetaCarScore",
  description: "Les meilleurs véhicules par catégorie.",
};

export default function TopsDirectoryPage() {
  
  const items: DirectoryItem[] = [
    {
      id: "marques",
      title: "Top Marques",
      subtitle: "Constructeurs",
      href: "/tops/marques",
      iconName: "grid",
      colorClass: "bg-purple-50 text-purple-600 border-purple-200"
    },
    {
      id: "general",
      title: "Top 100 Général",
      subtitle: "Toutes catégories",
      href: "/tops/modeles",
      iconName: "trophy", // <-- STRING
      colorClass: "bg-blue-50 text-blue-600 border-blue-200"
    },
    {
      id: "elec",
      title: "Top Électriques",
      subtitle: "BEV",
      href: "/tops/electrique",
      iconName: "zap", // <-- STRING
      colorClass: "bg-cyan-50 text-cyan-600 border-cyan-200"
    },
    {
      id: "hybrid",
      title: "Top Hybrides",
      subtitle: "PHEV & HEV",
      href: "/tops/hybride",
      iconName: "leaf",
      colorClass: "bg-lime-50 text-lime-700 border-lime-200"
    },
    {
      id: "essence",
      title: "Top Essence",
      subtitle: "Sport & Plaisir",
      href: "/tops/essence",
      iconName: "fuel",
      colorClass: "bg-red-50 text-red-600 border-red-200"
    },
    {
      id: "diesel",
      title: "Top Diesel",
      subtitle: "Routières",
      href: "/tops/diesel",
      iconName: "fuel",
      colorClass: "bg-amber-50 text-amber-600 border-amber-200"
    },
    {
      id: "manual",
      title: "Top Boîte Méca",
      subtitle: "Conduite pure",
      href: "/tops/manuelle",
      iconName: "cog",
      colorClass: "bg-slate-100 text-slate-600 border-slate-300"
    },
    {
      id: "breaks",
      title: "Top Breaks & SW",
      subtitle: "Volume & Style",
      href: "/tops/breaks",
      iconName: "luggage",
      colorClass: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:border-cyan-300"
    },
  {
    id: "convertible",
    title: "Top Découvrables",
    subtitle: "Cabriolets & Roadsters",
    href: "/tops/decouvrables",
    iconName: "sun", // Soleil
    colorClass: "bg-orange-50 text-orange-600 border-orange-200"
  },
  ];

  return (
    <GenericDirectoryClient 
      title="Classements" 
      subtitle="Explorez nos sélections thématiques basées sur la data."
      items={items}
      placeholderSearch="Chercher un classement..."
    />
  );
}