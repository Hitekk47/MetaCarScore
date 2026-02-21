import { Suspense } from "react";
import Header from "@/components/Header";
import DuelPageClient from "@/components/duels/DuelPageClient";
import { Loader2 } from "lucide-react";
import { Metadata } from 'next';
import { getFullContext } from "@/lib/queries";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ left?: string; right?: string }> }): Promise<Metadata> {
  const { left, right } = await searchParams;

  // 1. Page de base (sans sélection)
  if (!left || !right) {
    return {
      title: "Duel : Comparez les verdicts de la presse internationale de deux modèles",
      description:
        "Affrontez deux véhicules en VS et comparez instantanément leurs scores presse.",
    };
  }

  // 2. Résolution des noms (via RPC ou Fallback)
  const resolveDuelName = async (slug: string) => {
    const parts = slug.split('_');
    // Fallback rapide si slug malformé
    if (parts.length < 4) {
       return slug.replace(/[_-]/g, ' ');
    }

    const marque = parts[0];
    const famille = parts[1];
    const my = parseInt(parts[2]);
    const modele = parts.slice(3).join("_");

    // Tentative de résolution via RPC (cached)
    try {
      const context = await getFullContext({
        p_marque_slug: marque,
        p_famille_slug: famille,
        p_my: my,
        p_modele_slug: modele
      });

      if (context && context.real_marque && context.real_modele) {
        return `${context.real_marque} ${context.real_modele} (${my})`;
      }
    } catch (e) {
      console.error("Error resolving metadata context:", e);
    }

    // Fallback si context non trouvé ou erreur
    const capitalize = (s: string) => s.split(/[- ]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    // Join modele parts with space
    const prettyModele = parts.slice(3).map(p => capitalize(p.replace(/-/g, ' '))).join(' ');
    return `${capitalize(marque)} ${prettyModele} (${my})`;
  };

  const [nameA, nameB] = await Promise.all([
    resolveDuelName(left),
    resolveDuelName(right)
  ]);

  const title = `${nameA} vs ${nameB} : Le verdict de la presse internationale`;
  const description = `Verdict du duel : Comparez les notes de la presse et les avis experts entre la ${nameA} et la ${nameB} sur MetaCarScore.`;

  // --- LOGIQUE CANONIQUE CRUCIALE ---
  // On trie les slugs par ordre alphabétique pour que "A vs B" et "B vs A" pointent vers la même URL canonique.

  const sortedSlugs = [left, right].sort();
  const canonicalUrl = `/duels?left=${sortedSlugs[0]}&right=${sortedSlugs[1]}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'website',
    }
  };
}

export default function DuelsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background text-foreground">
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
