"use client";

import { useState } from "react";
import ReviewsTableCompact from "../tables/ReviewsTableCompact";
import { Review } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const ITEMS_PER_PAGE = 10;
const MAX_ITEMS = 1000; // 🛑 LIMITE DE SÉCURITÉ UI

export default function LatestReviewsSection({ initialData }: { initialData: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(ITEMS_PER_PAGE);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    // Sécurité supplémentaire : si on a déjà atteint la limite, on arrête tout.
    if (reviews.length >= MAX_ITEMS) {
        setHasMore(false);
        return;
    }

    setLoading(true);
    
    // On va chercher les suivants
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('Test_date', { ascending: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (data && data.length > 0) {
      const newReviews = [...reviews, ...data] as Review[];
      setReviews(newReviews);
      setOffset((prev) => prev + ITEMS_PER_PAGE);
      
      // LOGIQUE D'ARRÊT :
      // 1. Si Supabase renvoie moins de 10 résultats (fin de la base)
      // 2. OU SI on a dépassé notre limite artificielle de 1000
      if (data.length < ITEMS_PER_PAGE || newReviews.length >= MAX_ITEMS) {
        setHasMore(false);
      }
    } else {
      setHasMore(false);
    }
    
    setLoading(false);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
          Derniers ajouts
        </h2>
        <div className="flex items-center gap-2 md:pl-3 md:border-l border-slate-300 md:ml-2 shrink-0">
         
         {/* LE POINT VERT (Toujours à gauche) */}
         <span className="relative flex h-2 w-2 shrink-0"> {/* shrink-0 empêche le point de s'écraser */}
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
         </span>
         
         {/* LE TEXTE (Mise à jour) */}
         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">
            Mise à jour en temps réel
         </span>
      </div>
      </div>
      
      <ReviewsTableCompact data={reviews} />
      
      {/* Bouton visible seulement s'il reste des données ET qu'on n'a pas atteint 1000 */}
      {hasMore && reviews.length < MAX_ITEMS ? (
        <div className="mt-8 text-center">
          <button 
            onClick={loadMore}
            disabled={loading}
            className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-200 bg-slate-900 rounded-full focus:outline-none hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin w-4 h-4" /> Chargement...
              </span>
            ) : (
              <span>Afficher plus d'essais</span>
            )}
            
            {!loading && (
              <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:scale-105 transition-transform"></div>
            )}
          </button>
        </div>
      ) : (
        /* Petit message discret quand on atteint la limite */
        reviews.length >= MAX_ITEMS && (
            <div className="mt-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                Limite d'affichage atteinte
            </div>
        )
      )}
    </section>
  );
}