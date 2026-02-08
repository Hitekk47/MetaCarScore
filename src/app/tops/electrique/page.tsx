import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = { title: "Top 100 Voitures Électriques", description: "Le classement des meilleures voitures électriques." };

export default function TopElectriquePage() {
  return <GenericTopRankingClient title="Top 100 Électriques" subtitle="Silence et efficience." iconType="zap" colorTheme="cyan" filterCategory="Électrique" />;
}