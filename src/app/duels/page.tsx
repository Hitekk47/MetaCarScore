import { Suspense } from "react";
import Header from "@/components/Header";
import DuelPageClient from "@/components/duels/DuelPageClient";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Comparateur de Fiches & Scores | MetaCarScore",
  description:
    "Affrontez deux véhicules en duel. Comparez les scores presse, les fiches techniques et les avis détaillés.",
};

export default function DuelsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background text-foreground pt-24">
        {/* La Boundary Suspense est requise par Next.js pour useSearchParams() */}
        <Suspense 
          fallback={
            <div className="flex h-[50vh] w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <DuelPageClient />
        </Suspense>
      </main>
    </>
  );
}