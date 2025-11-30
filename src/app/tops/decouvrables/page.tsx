import GenericTopRankingClient from "@/components/pages/GenericTopRankingClient";

export const metadata = {
  title: "Classement des Meilleurs Cabriolets & Roadsters | MetaCarScore",
  description: "Découvrez les meilleures voitures découvrables (Cabriolets, Spiders, Targas) selon la presse automobile.",
};

export default function ConvertiblesPage() {
  return (
    <GenericTopRankingClient
      title="Top Découvrables"
      subtitle="Cheveux au vent, toit ouvert."
      iconType="sun"
      colorTheme="orange"
      customRpcName="get_convertible_ranking"
    />
  );
}