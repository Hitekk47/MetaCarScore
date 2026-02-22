"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Review, AggregatedSource } from "@/lib/types";
import ScoreBadge from "@/components/ui/ScoreBadge";
import { cn, aggregateReviews, getPowerRange } from "@/lib/utils";
import { Trophy, Minus, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import DuelScore from "./DuelScore";
import MiniScoreBar from "./MiniScoreBar";
import PowerBadge from "./PowerBadge";

type Props = {
  carA: { name: string; reviews: Review[]; my: number; url: string };
  carB: { name: string; reviews: Review[]; my: number; url: string };
};

// --- COMPOSANT PRINCIPAL ---

export default function DuelArena({ carA, carB }: Props) {
  
  // DETECTION DU STICKY MODE
  const [isCompact, setIsCompact] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCompact(!entry.isIntersecting);
      },
      {
        rootMargin: "-66px 0px 0px 0px", // 64px header + 2px
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const countA = carA.reviews.length;
  const countB = carB.reviews.length;
  const isValidA = countA >= 3;
  const isValidB = countB >= 3;

  const { matches, onlyA, onlyB, scoreA, scoreB, winsA, winsB, scoresArrayA, scoresArrayB } = useMemo(() => {
    const aggA = aggregateReviews(carA.reviews);
    const aggB = aggregateReviews(carB.reviews);
    const allSources = new Set([...Object.keys(aggA), ...Object.keys(aggB)]);
    
    const matchesList: { source: string; dataA: AggregatedSource; dataB: AggregatedSource }[] = [];
    const onlyAList: AggregatedSource[] = [];
    const onlyBList: AggregatedSource[] = [];
    let wA = 0; let wB = 0;

    allSources.forEach((source) => {
      const dataA = aggA[source];
      const dataB = aggB[source];

      if (dataA && dataB) {
        matchesList.push({ source, dataA, dataB });
        if (dataA.avgScore > dataB.avgScore) wA++;
        else if (dataB.avgScore > dataA.avgScore) wB++;
      } else if (dataA) onlyAList.push(dataA);
      else if (dataB) onlyBList.push(dataB);
    });

    matchesList.sort((a, b) => a.source.localeCompare(b.source));
    onlyAList.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    onlyBList.sort((a, b) => a.sourceName.localeCompare(b.sourceName));

    const finalScoreA = Math.round(Object.values(aggA).reduce((acc, curr) => acc + curr.avgScore, 0) / Object.keys(aggA).length || 0);
    const finalScoreB = Math.round(Object.values(aggB).reduce((acc, curr) => acc + curr.avgScore, 0) / Object.keys(aggB).length || 0);

    const allScoresA = carA.reviews.map(r => r.Score);
    const allScoresB = carB.reviews.map(r => r.Score);

    return { matches: matchesList, onlyA: onlyAList, onlyB: onlyBList, scoreA: finalScoreA, scoreB: finalScoreB, winsA: wA, winsB: wB, scoresArrayA: allScoresA, scoresArrayB: allScoresB };
  }, [carA.reviews, carB.reviews]);

  return (
    <div className="relative isolate">
        
        {/* Sentinelle - Doit rester hors du flux changeant pour éviter les boucles */}
        <div ref={triggerRef} className="h-px w-full absolute -top-1 pointer-events-none opacity-0" />

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full bg-white rounded-xl shadow-sm border border-slate-200"
        >
        
        {/* === STICKY HEADER (BLANC) === */}
        <div className={cn(
            "sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm grid grid-cols-3 px-2 md:px-6 rounded-t-xl transition-all duration-500 ease-in-out overflow-hidden will-change-[padding,height]",
            isCompact ? "py-2 items-center" : "py-6"
        )}>
            
            {/* CAR A */}
            <div className={cn("flex flex-col items-center justify-start text-center relative z-10 transition-all", !isValidA && "opacity-80")}>
                <div className={cn("w-full flex items-end justify-center transition-all duration-500", isCompact ? "h-6 mb-1" : "h-10 md:h-12 mb-3")}>
                    <Link href={carA.url} className="block group">
                        <h2 className={cn(
                            "font-bold text-slate-500 uppercase tracking-wider w-full leading-tight group-hover:text-blue-600 transition-all duration-300",
                            isCompact ? "text-[9px] line-clamp-1" : "text-[10px] md:text-xs line-clamp-2"
                        )}>
                            <span className="text-slate-400 mr-1 font-mono">{carA.my}</span>
                            {carA.name}
                        </h2>
                    </Link>
                </div>
                
                {/* Score Badge - Transition fluide via scale */}
                <div className={cn("transition-transform duration-500 ease-out origin-center", isCompact && "scale-75")}>
                    <ScoreBadge score={isValidA ? scoreA : 0} size={isCompact ? "md" : "xl"} reviewCount={countA} />
                </div>
                
                {/* LES EXTRAS DISPARAISSENT EN MODE COMPACT */}
                <div className={cn(
                    "flex flex-col items-center transition-all duration-500 ease-in-out overflow-hidden", 
                    isCompact ? "max-h-0 opacity-0 mt-0" : "max-h-24 opacity-100 mt-2"
                )}>
                    {isValidA && (
                        <>
                            <div className="mt-3"><MiniScoreBar scores={scoresArrayA} /></div>
                            <div className="mt-1 px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600 flex items-center gap-1.5"><Gauge size={12} className="text-slate-400" />{getPowerRange(carA.reviews)}</div>
                        </>
                    )}
                </div>
            </div>

            {/* VS CENTER */}
            <div className="flex flex-col items-center justify-center relative z-10 transition-all">
                <span className={cn("font-black text-slate-200 italic pr-1 select-none transition-all duration-300", isCompact ? "text-xl" : "text-2xl md:text-4xl")}>VS</span>
                {matches.length > 0 && (
                    <div className={cn("font-bold font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm transition-all duration-300", isCompact ? "mt-1 text-[8px]" : "mt-2 text-[9px]")}>
                        <span className={winsA > winsB ? "text-emerald-600" : ""}>{winsA}</span>
                        <span className="mx-1">-</span>
                        <span className={winsB > winsA ? "text-emerald-600" : ""}>{winsB}</span>
                    </div>
                )}
            </div>

            {/* CAR B */}
            <div className={cn("flex flex-col items-center justify-start text-center relative z-10 transition-all", !isValidB && "opacity-80")}>
                <div className={cn("w-full flex items-end justify-center transition-all duration-500", isCompact ? "h-6 mb-1" : "h-10 md:h-12 mb-3")}>
                    <Link href={carB.url} className="block group">
                        <h2 className={cn(
                            "font-bold text-slate-500 uppercase tracking-wider w-full leading-tight group-hover:text-blue-600 transition-all duration-300",
                            isCompact ? "text-[9px] line-clamp-1" : "text-[10px] md:text-xs line-clamp-2"
                        )}>
                            <span className="text-slate-400 mr-1 font-mono">{carB.my}</span>
                            {carB.name}
                        </h2>
                    </Link>
                </div>

                <div className={cn("transition-transform duration-500 ease-out origin-center", isCompact && "scale-75")}>
                    <ScoreBadge score={isValidB ? scoreB : 0} size={isCompact ? "md" : "xl"} reviewCount={countB} />
                </div>

                <div className={cn(
                    "flex flex-col items-center transition-all duration-500 ease-in-out overflow-hidden", 
                    isCompact ? "max-h-0 opacity-0 mt-0" : "max-h-24 opacity-100 mt-2"
                )}>
                    {isValidB && (
                        <>
                            <div className="mt-3"><MiniScoreBar scores={scoresArrayB} /></div>
                            <div className="mt-1 px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600 flex items-center gap-1.5"><Gauge size={12} className="text-slate-400" />{getPowerRange(carB.reviews)}</div>
                        </>
                    )}
                </div>
            </div>
        </div>

        {/* === SECTION HEADER (GRIS) : FIXE === */}
        {/* On retire la logique d'expansion h-48 qui causait le layout shift et le flicker */}
        <div className="bg-slate-50 border-b border-slate-100 h-10 flex items-center justify-center overflow-hidden">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
                <Trophy size={12} /> Face-à-Face ({matches.length})
            </span>
        </div>

        {/* === LISTE DES ESSAIS === */}
        <div className="divide-y divide-slate-100">
            {matches.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm italic">Aucune source commune.</div>
            ) : (
                matches.map(({ source, dataA, dataB }) => {
                    const winA = dataA.avgScore > dataB.avgScore;
                    const winB = dataB.avgScore > dataA.avgScore;
                    const draw = dataA.avgScore === dataB.avgScore;

                    return (
                        <div key={source} className="grid grid-cols-3 items-center py-4 px-2 md:px-6 hover:bg-slate-50 transition-colors">
                            <div className={cn("flex justify-center md:justify-end pr-0 md:pr-8", !winA && !draw && "opacity-40 grayscale")}>
                                <DuelScore score={dataA.avgScore} count={dataA.count} isWinner={winA} />
                            </div>
                            <div className="flex justify-center">
                                <span className="text-[10px] md:text-xs font-bold uppercase text-slate-700 text-center truncate px-2">
                                    {source}
                                </span>
                            </div>
                            <div className={cn("flex justify-center md:justify-start pl-0 md:pl-8", !winB && !draw && "opacity-40 grayscale")}>
                                <DuelScore score={dataB.avgScore} count={dataB.count} isWinner={winB} />
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        {/* --- ESSAIS UNIQUES --- */}
        {(onlyA.length > 0 || onlyB.length > 0) && (
            <>
                <div className="bg-slate-50 py-2 text-center border-y border-slate-100 mt-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
                        <Minus size={12} /> Essais Uniques
                    </span>
                </div>
                
                <div className="divide-y divide-slate-100 bg-slate-50/20">
                    {onlyA.map((item) => (
                        <div key={`A-${item.sourceName}`} className="grid grid-cols-3 items-center py-4 px-2 md:px-6 hover:bg-slate-50">
                            <div className="flex justify-center md:justify-end pr-0 md:pr-8"><DuelScore score={item.avgScore} count={item.count} /></div>
                            <div className="flex justify-center"><span className="text-[10px] md:text-xs font-bold uppercase text-slate-400 text-center truncate">{item.sourceName}</span></div>
                            <div className="flex justify-center md:justify-start pl-0 md:pl-8"><div className="w-8 h-1 bg-slate-200/50 rounded-full"></div></div>
                        </div>
                    ))}

                    {onlyB.map((item) => (
                        <div key={`B-${item.sourceName}`} className="grid grid-cols-3 items-center py-4 px-2 md:px-6 hover:bg-slate-50">
                            <div className="flex justify-center md:justify-end pr-0 md:pr-8"><div className="w-8 h-1 bg-slate-200/50 rounded-full"></div></div>
                            <div className="flex justify-center"><span className="text-[10px] md:text-xs font-bold uppercase text-slate-400 text-center truncate">{item.sourceName}</span></div>
                            <div className="flex justify-center md:justify-start pl-0 md:pl-8"><DuelScore score={item.avgScore} count={item.count} /></div>
                        </div>
                    ))}
                </div>
            </>
        )}

        </motion.div>
    </div>
  );
}
