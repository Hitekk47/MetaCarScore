import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = {
  title: "Top 100 Modèles | MetaCarScore",
  description: "Le classement définitif des 100 meilleures voitures du marché, toutes catégories confondues.",
};

export default function TopModelesPage() {
  return (
    <GenericTopRankingClient 
      title="Top 100 Modèles" 
      subtitle="Les véhicules les mieux notés, toutes catégories confondues." 
      iconType="trophy" 
      colorTheme="blue" 
      // Pas de filtre category ni transmission = Top Général
    />
  );
}