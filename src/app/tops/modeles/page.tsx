import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleurs Voitures ${currentYear} : Le Top 100 Global`,
    description: `Quelle est la meilleure voiture du marché en ${currentYear} ? Découvrez le classement de référence basé sur l'agrégation des notes de la presse. Filtrez par segment (SUV, Citadines, Berlines, Sportives) pour trouver le modèle idéal.`,
  };
}
export default function TopModelesPage() {
  return (
    <GenericTopRankingClient 
      title="Top 100 Modèles" 
      subtitle="Les véhicules les mieux notés, filtrable par segment." 
      iconType="trophy" 
      colorTheme="blue" 
      // Pas de filtre category ni transmission = Top Général
    />
  );
}