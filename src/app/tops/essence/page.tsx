import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleurs Essence ${currentYear} : Le Top 100`,
    description: `Découvrez quelles sont les voitures essences les mieux notées par la presse internationale. Un classement unique basé sur l'agrégation de milliers d'avis d'experts.`,
  };
}
export default function TopEssencePage() {
  return <GenericTopRankingClient title="Top 100 Essence" subtitle="La passion du moteur thermique." iconType="fuel" colorTheme="red" filterCategory="Essence" />;
}