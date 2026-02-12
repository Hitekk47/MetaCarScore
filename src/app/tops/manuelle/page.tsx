import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleures Voitures en Boîte Manuelle ${currentYear}`,
    description: `Découvrez quelles sont les voitures en boîte mécanique les mieux notées par la presse internationale. Un classement unique basé sur l'agrégation de milliers d'avis d'experts.`,
  };
}
export default function TopManuellePage() {
  return <GenericTopRankingClient title="Top 100 Boîte Méca" subtitle="Le plaisir de conduire à l'ancienne." iconType="manual" colorTheme="slate" filterTransmission="M" />;
}