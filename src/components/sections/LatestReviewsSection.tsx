"use client";

import { useState, useEffect } from "react";
import ReviewsTableCompact from "../tables/ReviewsTableCompact";
import { Review } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const ITEMS_PER_PAGE = 10;
const MAX_ITEMS = 1000;

export default function LatestReviewsSection({ initialData }: { initialData: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // --- SYNCHRONISATION (Au cas où le parent revalidate) ---
  useEffect(() => {
    setReviews(initialData);
    setHasMore(true);
  }, [initialData]);

  const loadMore = async () => {
    const currentLength = reviews.length;

    if (currentLength >= MAX_ITEMS) {
        setHasMore(false);
        return;
    }

    setLoading(true);
    
    // On utilise la longueur actuelle comme offset. C'est infaillible.
    const from = currentLength;
    const to = currentLength + ITEMS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('Test_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (data && data.length > 0) {
      // On ajoute les nouveaux (sans écraser)
      // Note : TypeScript peut râler sur le type, on force le cast
      setReviews(prev => [...prev, ...data as Review[]]);
      
      // Si on a reçu moins que demandé, c'est la fin
      if (data.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }
    } else {
      setHasMore(false);
    }
    
    setLoading(false);
  };

  return (
<section className="max-w-7xl mx-auto px-4 py-16">
  {/* HEADER DE SECTION */}
  <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
    <div>
      <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">
        Derniers Essais Presse <span className="text-blue-600">Automobile</span>
      </h2>
    </div>

    {/* BADGE LIVE */}
    <div className="flex items-center gap-3 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 self-start md:self-auto">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 whitespace-nowrap">
        Mis à jour en temps réel
      </span>
    </div>
  </div>
      
      {/* TABLEAU */}
      {/* Important : On passe hideBrand={false} explicitement (par défaut) car ici on veut voir la marque */}
      <ReviewsTableCompact data={reviews} />
      
      {/* BOUTON CHARGER PLUS */}
      {hasMore && reviews.length < MAX_ITEMS ? (
        <div className="mt-8 text-center">
          <button 
            onClick={loadMore}
            disabled={loading}
            className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-200 bg-slate-900 rounded-full focus:outline-none hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin w-4 h-4" /> Chargement...
              </span>
            ) : (
              <span>Afficher plus d'essais</span>
            )}
          </button>
        </div>
      ) : (
        /* Message de fin */
        reviews.length >= MAX_ITEMS && (
            <div className="mt-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
                Limite d'affichage atteinte ({MAX_ITEMS} essais)
            </div>
        )
      )}
    </section>
  );
}