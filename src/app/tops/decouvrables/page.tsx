import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleurs Cabriolet & Roadsters ${currentYear}`,
    description: `Découvrez quelles sont les voitures découvrables (Cabriolets, Roadsters, Spiders, Targas) les mieux notées par la presse internationale. Un classement unique basé sur l'agrégation de milliers d'avis d'experts.`,
  };
}

export default function ConvertiblesPage() {
  return (
    <GenericTopRankingClient
      title="Top 100 Découvrables"
      subtitle="Cheveux au vent, toit ouvert."
      iconType="sun"
      colorTheme="orange"
      customRpcName="get_convertible_ranking"
    />
  );
}