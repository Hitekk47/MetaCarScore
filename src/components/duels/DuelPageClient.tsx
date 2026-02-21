"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Review } from "@/lib/types";
import SearchBar from "@/components/ui/SearchBar";
import DuelArena from "./DuelArena";
import { Swords, X, Loader2, CarFront } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSlug } from "@/lib/slugify";
// ⚡ IMPORT DE NOTRE NOUVELLE SERVER ACTION
import { fetchBatchFighterReviews } from "@/actions/duels";

type Fighter = {
  id: string; 
  name: string;
  reviews: Review[];
  loading: boolean;
};

// Typage strict pour remplacer le 'any' de Jules
type SearchResult = {
  Marque: string;
  Famille: string;
  MaxMY: number;
  Modele: string;
  Type: string;
};

export default function DuelPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [leftFighter, setLeftFighter] = useState<Fighter | null>(null);
  const [rightFighter, setRightFighter] = useState<Fighter | null>(null);

  // 1. ÉCOUTE DE L'URL ET CHARGEMENT GROUPÉ
  const leftParam = searchParams.get("left");
  const rightParam = searchParams.get("right");

  useEffect(() => {
    // Fonction interne pour charger les véhicules en batch
    const loadFighters = async (rawItems: { slug: string; side: "left" | "right" }[]) => {
        const items = rawItems.filter(({ slug }) => slug.split("_").length >= 4);
        if (items.length === 0) return;

        // Set loading state for all items
        items.forEach(({ slug, side }) => {
            const parts = slug.split("_");
            const marque = parts[0];
            const modele = parts.slice(3).join("_");

            const loadingState: Fighter = {
                id: slug,
                name: `${marque} ${modele}`,
                reviews: [],
                loading: true
            };

            if (side === "left") {
                setLeftFighter(loadingState);
            } else {
                setRightFighter(loadingState);
            }
        });

        // Fetch in a single batch request
        const slugs = items.map(i => i.slug);
        const results = await fetchBatchFighterReviews(slugs);

        // Update state with results
        items.forEach(({ slug, side }) => {
            const reviews = results[slug] || [];
            const parts = slug.split("_");
            const marque = parts[0];
            const modele = parts.slice(3).join("_");

            const finalState: Fighter = {
                id: slug,
                name: `${marque} ${modele}`,
                reviews: reviews,
                loading: false
            };

            if (side === "left") {
                setLeftFighter(finalState);
            } else {
                setRightFighter(finalState);
            }
        });
    };

    const slugsToLoad: { slug: string; side: "left" | "right" }[] = [];

    // Check if left fighter needs loading
    if (leftParam && (!leftFighter || leftFighter.id !== leftParam)) {
      slugsToLoad.push({ slug: leftParam, side: "left" });
    }

    // Check if right fighter needs loading
    if (rightParam && (!rightFighter || rightFighter.id !== rightParam)) {
      slugsToLoad.push({ slug: rightParam, side: "right" });
    }

    if (slugsToLoad.length > 0) {
      loadFighters(slugsToLoad);
    }
  }, [leftParam, rightParam, leftFighter, rightFighter]);

  const getCarUrl = (fighter: Fighter) => {
    const parts = fighter.id.split("_");
    const marque = parts[0];
    const famille = parts[1];
    const my = parts[2];
    const modele = parts.slice(3).join("_");
    return `/${toSlug(marque)}/${toSlug(famille)}/${my}/${toSlug(modele)}`;
  };

  const handleSelect = (res: SearchResult, side: "left" | "right") => {
    if (res.Type === 'family' || !res.Modele || !res.MaxMY) {
        alert("Veuillez sélectionner un modèle spécifique (avec année) pour le duel.");
        return;
    }

    const slug = `${res.Marque}_${res.Famille}_${res.MaxMY}_${res.Modele}`;
    
    const params = new URLSearchParams(searchParams.toString());
    params.set(side, slug);
    router.replace(`/duels?${params.toString()}`, { scroll: false });
  };

  const removeFighter = (side: "left" | "right") => {
    if (side === "left") {
        setLeftFighter(null);
    } else {
        setRightFighter(null);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(side);
    router.replace(`/duels?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      
      <div className="text-center mb-8 md:mb-12">
        <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-blue-100 rounded-full mb-4 text-blue-600">
            <Swords size={24} className="md:w-8 md:h-8" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Mode Duel</h1>
        <p className="text-slate-500 text-sm md:text-base">Comparez les verdicts de la presse internationale.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-12">
        <FighterSlot 
            fighter={leftFighter} 
            side="left" 
            onSelect={(res) => handleSelect(res as SearchResult, "left")} 
            onRemove={() => removeFighter("left")} 
        />
        <FighterSlot 
            fighter={rightFighter} 
            side="right" 
            onSelect={(res) => handleSelect(res as SearchResult, "right")} 
            onRemove={() => removeFighter("right")} 
        />
      </div>

      {leftFighter && !leftFighter.loading && rightFighter && !rightFighter.loading ? (
        <div className="animate-in fade-in slide-in-from-bottom-10 duration-700">
            <DuelArena 
                carA={{ 
                    name: leftFighter.name, 
                    reviews: leftFighter.reviews,
                    my: parseInt(leftFighter.id.split('_')[2]),
                    url: getCarUrl(leftFighter)
                }}
                carB={{ 
                    name: rightFighter.name, 
                    reviews: rightFighter.reviews, 
                    my: parseInt(rightFighter.id.split('_')[2]),
                    url: getCarUrl(rightFighter)
                }}
            />
        </div>
      ) : (
         (!leftFighter && !rightFighter) && (
            <div className="text-center py-10 md:py-20 opacity-50 select-none">
                <p className="text-xs md:text-sm font-bold uppercase tracking-widest text-slate-300">Sélectionnez deux véhicules</p>
            </div>
         )
      )}

    </div>
  );
}

// SOUS-COMPOSANT : SLOT DE SÉLECTION
function FighterSlot({ fighter, side, onSelect, onRemove }: { fighter: Fighter | null, side: "left" | "right", onSelect: (res: SearchResult) => void, onRemove: () => void }) {
    const isRight = side === "right";
    const my = fighter ? fighter.id.split('_')[2] : null;

    if (fighter) {
        return (
            <div className={cn("relative p-4 md:p-6 rounded-2xl border transition-all h-full min-h-[160px] flex flex-col items-center justify-center", isRight ? "bg-red-50/50 border-red-100" : "bg-blue-50/50 border-blue-100")}>
                <button onClick={onRemove} className="absolute top-3 right-3 p-1.5 bg-white rounded-full shadow-sm text-slate-400 hover:text-red-500 transition hover:scale-110">
                    <X size={14} />
                </button>
                
                <div className="flex flex-col items-center text-center">
                    {fighter.loading ? (
                        <Loader2 className="animate-spin text-slate-400 mb-2" size={24} />
                    ) : (
                        <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 text-white shadow-sm", isRight ? "bg-red-500" : "bg-blue-600")}>
                            <CarFront size={20} className="md:w-6 md:h-6" />
                        </div>
                    )}
                    
                    <h3 className="text-lg md:text-2xl font-black uppercase text-slate-900 tracking-tight leading-none mb-2">
                        <span className="text-slate-400 mr-2 font-mono">{my}</span>
                        {fighter.name}
                    </h3>
                    {!fighter.loading && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white px-2 py-1 rounded shadow-sm border border-slate-100">
                            {fighter.reviews.length} Essais
                        </span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full min-h-[160px]",!isRight ? "relative z-20" : "relative z-10")}>
            <div className="flex-1 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-4 md:p-6 hover:border-blue-400 hover:bg-slate-50/50 transition-all group">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-300 mb-3 group-hover:text-blue-500 transition-colors font-black text-sm md:text-base border border-slate-100">
                    {isRight ? "2" : "1"}
                </div>
                <div className="w-full max-w-xs relative z-10">
                    <SearchBar 
                        placeholder={isRight ? "Ajouter un adversaire..." : "Premier véhicule..."} 
                        variant="header"
                        className="shadow-sm"
                        onSelect={onSelect}
                        modelOnly={true}
                    />
                </div>
                <p className="text-[10px] md:text-xs font-medium text-slate-400 mt-3 text-center opacity-70 group-hover:opacity-100 transition-opacity">
                    Recherchez un modèle spécifique (ex: 911 GT3)
                </p>
            </div>
        </div>
    );
}