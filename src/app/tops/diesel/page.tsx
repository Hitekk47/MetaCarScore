import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleurs Diesel ${currentYear} : Le Top 100`,
    description: `Découvrez quelles sont les voitures diesel les mieux notées par la presse internationale. Un classement unique basé sur l'agrégation de milliers d'avis d'experts.`,
  };
}
export default function TopDieselPage() {
  return <GenericTopRankingClient title="Top 100 Diesel" subtitle="Les reines de l'autoroute." iconType="diesel" colorTheme="amber" filterCategory="Diesel" />;
}