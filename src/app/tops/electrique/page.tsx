import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleurs Électriques ${currentYear} : Le Top 100`,
    description: `Découvrez quelles sont les voitures électriques (BEV) les mieux notées par la presse internationale. Un classement unique basé sur l'agrégation de milliers d'avis d'experts.`,
  };
}
export default function TopElectriquePage() {
  return <GenericTopRankingClient title="Top 100 Électriques" subtitle="Silence et efficience." iconType="zap" colorTheme="cyan" filterCategory="Électrique" />;
}