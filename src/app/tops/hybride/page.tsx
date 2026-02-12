import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleurs Hybrides ${currentYear} : Le Top 100`,
    description: `Découvrez quelles sont les voitures PHEV & HEV les mieux notées par la presse internationale. Un classement unique basé sur l'agrégation de milliers d'avis d'experts.`,
  };
}
export default function TopHybridePage() {
  return <GenericTopRankingClient title="Top 100 Hybrides" subtitle="Le meilleur des deux mondes." iconType="leaf" colorTheme="green" filterCategory="Hybride" />;
}