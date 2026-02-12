import TopMarquesClient from "@/components/pages/TopMarquesClient";
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();

  return {
    title: `Classement des Meilleures Marques Automobiles ${currentYear}`,
    description: `Découvrez le classement objectif des constructeurs automobiles basé sur des milliers d'essais presse. Un classement unique basé sur l'agrégation d'avis d'experts.`,
  };
}
export default function TopMarquesPage() {
  return <TopMarquesClient />;
}