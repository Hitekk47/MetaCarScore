import Header from "@/components/Header"; // <-- AJOUT IMPORT
import DuelPageClient from "@/components/duels/DuelPageClient";

export const metadata = {
  title: "Comparateur de Fiches & Scores | MetaCarScore",
  description: "Affrontez deux véhicules en duel. Comparez les scores presse, les fiches techniques et les avis détaillés.",
};

export default function DuelsPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      
      {/* 1. ON AJOUTE LE HEADER ICI */}
      <Header />

      <main>
        <DuelPageClient />
      </main>
      
    </div>
  );
}