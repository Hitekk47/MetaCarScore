"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import ScoreBadge from '../ui/ScoreBadge';
import { cn } from '@/lib/utils';
import { toSlug } from "@/lib/slugify";

type CarouselItem = {
  Marque: string;
  Famille: string;
  Modele: string;
  MY: number;
  AvgScore: number;
  ReviewCount: number;
  MinPower: number;
  MaxPower: number;
  FirstTestDate: string;
};

export default function RecentScoresCarousel({ items }: { items: CarouselItem[] }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // LOGIQUE BADGE NEW :
  // On compare avec la date du premier élément (le plus récent car la liste est triée par date)
  const latestDate = items.length > 0 ? items[0].FirstTestDate : null;

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      // Marge de tolérance de 5px
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => { handleScroll(); }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group/carousel">
      
      {/* --- FLÈCHE GAUCHE --- */}
      <div className={cn(
        "absolute top-1/2 -left-4 -translate-y-1/2 z-20 transition-all duration-300",
        showLeftArrow ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
      )}>
        <button 
          onClick={() => scroll('left')}
          className="w-12 h-12 bg-white rounded-full shadow-xl border border-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
        >
            <ChevronLeft size={24} strokeWidth={3} />
        </button>
      </div>

      {/* --- FLÈCHE DROITE --- */}
      <div className={cn(
        "absolute top-1/2 -right-4 -translate-y-1/2 z-20 transition-all duration-300",
        showRightArrow ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
      )}>
        <button 
          onClick={() => scroll('right')}
          className="w-12 h-12 bg-white rounded-full shadow-xl border border-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
        >
            <ChevronRight size={24} strokeWidth={3} />
        </button>
      </div>

      {/* --- CONTENEUR SCROLLABLE --- */}
      <div 
        ref={scrollContainerRef} 
        onScroll={handleScroll} 
        className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory scrollbar-hide px-1" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
            // Est-ce une nouveauté ? (Même date de sortie que le plus récent)
            const isNew = latestDate && item.FirstTestDate === latestDate;

            return (
              <div key={`${item.Marque}-${item.MY}-${item.Modele}`} className="snap-center shrink-0 w-[280px] md:w-[320px]">
                
                {/* LIEN GLOBAL SUR LA CARTE VERS LA PAGE MODÈLE */}
                <Link 
                    href={`/${toSlug(item.Marque)}/${toSlug(item.Famille)}/${item.MY}/${toSlug(item.Modele)}`}
                    className="block bg-white border border-slate-200 rounded-xl p-6 h-full hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group/card relative flex flex-col justify-between min-h-[200px]"
                >
                  
                  {/* BADGE NEW */}
                  {isNew && (
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider z-10 shadow-sm">
                      New
                    </div>
                  )}

                  {/* HEADER CARD */}
                  <div className="flex justify-between items-start">
                    <div className="pr-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                {item.Famille}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded border border-slate-200 uppercase tracking-tighter">
                                MY {item.MY}
                            </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight group-hover/card:text-blue-600 transition-colors">
                            {item.Marque} <br/> {item.Modele}
                        </h3>
                    </div>
                    <ScoreBadge score={Math.round(item.AvgScore)} size="md" />
                  </div>

                  {/* FOOTER CARD */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-end justify-between">
                    
                    {/* Nombre d'essais */}
                    <div className="text-xs text-slate-400 font-medium">
                       <strong className="text-slate-700">{item.ReviewCount}</strong> essais
                    </div>

                    {/* Puissance avec Icône Gauge */}
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-900 font-mono font-bold text-sm">
                            <Gauge className="w-4 h-4 text-slate-400" strokeWidth={2.5} /> 
                            
                            {item.MinPower === item.MaxPower 
                                ? <span>{item.MinPower}</span> 
                                : <span>{item.MinPower}-{item.MaxPower}</span>
                            }
                            <span className="text-[10px] text-slate-400 uppercase font-sans">ch</span>
                        </div>
                    </div>
                  </div>

                  {/* BARRE DE PROGRESSION */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-50 overflow-hidden rounded-b-xl">
                    <div 
                      className={cn("h-full transition-all duration-500", 
                        item.AvgScore >= 61 ? 'bg-score-good' : item.AvgScore >= 40 ? 'bg-score-mixed' : 'bg-score-bad'
                      )} 
                      style={{ width: `${item.AvgScore}%` }}
                    ></div>
                  </div>

                </Link>
              </div>
            );
        })}
      </div>
      
       {/* Ombres de défilement latérales */}
       <div className={cn("absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-[#f8fafc] to-transparent pointer-events-none transition-opacity", showRightArrow ? 'opacity-100' : 'opacity-0')}></div>
       <div className={cn("absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-[#f8fafc] to-transparent pointer-events-none transition-opacity", showLeftArrow ? 'opacity-100' : 'opacity-0')}></div>
    </div>
  );
}