import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = { title: "Top 100 Boîte Manuelle", description: "Pour les puristes de la conduite." };

export default function TopManuellePage() {
  return <GenericTopRankingClient title="Top 100 Boîte Méca" subtitle="Le plaisir de conduire à l'ancienne." iconType="manual" colorTheme="slate" filterTransmission="M" />;
}