import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = {
  title: "Classement des Meilleurs Breaks | MetaCarScore",
  description: "Découvrez les meilleurs breaks, wagons et shooting brakes du marché selon la presse automobile.",
};

export default function BreaksPage() {
  return (
    <GenericTopRankingClient
      title="Top Breaks"
      subtitle="Les meilleures déménageuses selon la presse."
      iconType="luggage"
      colorTheme="slate"
      customRpcName="get_break_ranking"
    />
  );
}