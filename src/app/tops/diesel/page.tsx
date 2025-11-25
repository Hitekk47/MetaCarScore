import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = { title: "Top 100 Voitures Diesel", description: "Les meilleures routières." };

export default function TopDieselPage() {
  return <GenericTopRankingClient title="Top 100 Diesel" subtitle="Les reines de l'autoroute." iconType="diesel" colorTheme="amber" filterCategory="Diesel" />;
}