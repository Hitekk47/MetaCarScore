import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = { title: "Top 100 Voitures Essence", description: "Les sportives et thermiques pures." };

export default function TopEssencePage() {
  return <GenericTopRankingClient title="Top 100 Essence" subtitle="La passion du moteur thermique." iconType="fuel" colorTheme="red" filterCategory="Essence" />;
}