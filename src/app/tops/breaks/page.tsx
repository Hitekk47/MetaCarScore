import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleurs Breaks & SW ${currentYear}`,
    description: `Découvrez quelles sont les voitures breaks, wagons et shooting brakes les mieux notées par la presse internationale. Un classement unique basé sur l'agrégation de milliers d'avis d'experts.`,
  };
}

export default function BreaksPage() {
  return (
    <GenericTopRankingClient
      title="Top 100 Breaks"
      subtitle="Les meilleures déménageuses selon la presse."
      iconType="luggage"
      colorTheme="slate"
      customRpcName="get_break_ranking"
    />
  );
}