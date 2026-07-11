import { notFound } from "next/navigation";
import GenericPageClient from "@/components/pages/GenericPageClient";
import { Review } from "@/lib/types";

export default function TestSeoPage() {
  const mockReviews: Review[] = [
    {
      supabase_id: 1,
      MY: 2023,
      Marque: "Porsche",
      Famille: "911",
      Modele: "GT3",
      Puissance: 510,
      Type: "Essence",
      Transmission: "7A",
      Finition: "Pack Touring",
      Testeur: "Top Gear",
      Test_date: "2023/05",
      Score: 95
    }
  ];

  const seoText = "Le Porsche GT3 (2023) s'inscrit dans le segment des Sportive Compacte. Sur la base de 10 essais, il obtient le MetaCarScore de 85/100. La presse affiche un franc consensus autour de ce véhicule. Les avis sont majoritairement positifs (80%). Il se classe actuellement 2ème sur 15 de sa catégorie, au-dessus de la moyenne du segment qui est de 80/100.";

  return (
    <GenericPageClient
      initialReviews={mockReviews}
      marque="Porsche"
      famille="911"
      my="2023"
      modele="GT3"
      level="modele"
      seoText={seoText}
    />
  );
}
