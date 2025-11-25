import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = { title: "Top 100 Voitures Hybrides", description: "Le classement des meilleures voitures hybrides." };

export default function TopHybridePage() {
  return <GenericTopRankingClient title="Top 100 Hybrides" subtitle="Le meilleur des deux mondes." iconType="leaf" colorTheme="green" filterCategory="Hybride" />;
}