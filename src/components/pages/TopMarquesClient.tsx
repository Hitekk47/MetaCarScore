"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import ScoreBadge from "@/components/ui/ScoreBadge";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toSlug } from "@/lib/slugify";
import { Trophy, Loader2, Search, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { BrandRankingItem } from "@/lib/types";
import BrandPodiumStep from "@/components/ranking/BrandPodiumStep";

type TimeRange = '1y' | '5y' | 'all';

const getTier = (score: number) => {
    if (score >= 85) return { label: "S-Tier", color: "text-purple-600 border-purple-200 bg-purple-50" };
    if (score >= 75) return { label: "A-Tier", color: "text-emerald-700 border-emerald-200 bg-emerald-50" };
    if (score >= 70) return { label: "B-Tier", color: "text-emerald-600 border-emerald-100 bg-emerald-50/50" };
    if (score >= 65) return { label: "C-Tier", color: "text-yellow-600 border-yellow-200 bg-yellow-50" };
    return { label: "D-Tier", color: "text-red-600 border-red-200 bg-red-50" };
};

export default function TopMarquesClient() {
  const [timeRange, setTimeRange] = useState<TimeRange>('5y');
  const [data, setData] = useState<BrandRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchRanking() {
      setLoading(true);
      
      // LOGIQUE MODIFIÉE ICI :
      let targetMY: number | null = null;
      const currentYear = new Date().getFullYear();

      if (timeRange === '1y') targetMY = currentYear - 1; // ex: 2024
      else if (timeRange === '5y') targetMY = currentYear - 5; // ex: 2020
      
      // APPEL V2 : 'min_my' au lieu de 'min_date'
      const { data: ranking } = await supabase.rpc('get_brand_ranking_v3', { 
        min_my: targetMY,
        min_count: 5
      });

      if (ranking) setData(ranking);
      setLoading(false);
    }
    fetchRanking();
  }, [timeRange]);

  const filteredData = useMemo(() => {
    return data.filter(item => item.brand.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [data, searchQuery]);

  // Optimisation: Carte des rangs pour éviter O(N^2) dans le rendu de la liste
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item, index) => {
      map.set(item.brand, index + 1);
    });
    return map;
  }, [data]);

  const podium = filteredData.slice(0, 3);
  const list = filteredData.slice(3);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* HEADER & TABS (Inchangés) */}
        <div className="text-center mb-8 md:mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-2xl mb-4 shadow-sm text-yellow-600"><Trophy size={32} /></div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-2">Classement Marques</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">Qui fabrique les meilleures voitures selon la presse ?</p>
        </div>

        <div className="flex justify-center mb-12 relative z-20">
            <div className="bg-white p-1 rounded-full border border-slate-200 shadow-sm flex relative">
                <motion.div layoutId="tab-bg" className="absolute bg-slate-900 rounded-full h-[calc(100%-8px)] top-[4px]" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} style={{ left: timeRange === '1y' ? 4 : timeRange === '5y' ? '33.33%' : '66.66%', width: '32%' }} />
                {['1y', '5y', 'all'].map((t) => (<button key={t} onClick={() => setTimeRange(t as TimeRange)} className={cn("relative z-10 w-20 md:w-32 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold transition-colors", timeRange === t ? "text-white" : "text-slate-500 hover:text-slate-900")}>{t === '1y' ? '1 an' : t === '5y' ? '5 ans' : 'Toujours'}</button>))}
            </div>
        </div>

        <div className="relative min-h-[400px]">
            {loading && <div className="absolute inset-0 z-30 flex items-start justify-center pt-20 bg-[#f8fafc]/50 backdrop-blur-[1px]"><Loader2 className="animate-spin text-slate-900" size={48} /></div>}

            <motion.div key={timeRange} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={cn("transition-opacity duration-300", loading ? "opacity-40" : "opacity-100")}>
                
                {podium.length === 3 && searchQuery === "" && (
                    <div className="flex items-end justify-center gap-2 md:gap-6 mb-16 h-auto px-2 pt-8 relative z-10">
                        <BrandPodiumStep item={podium[1]} rank={2} />
                        <BrandPodiumStep item={podium[0]} rank={1} />
                        <BrandPodiumStep item={podium[2]} rank={3} />
                    </div>
                )}

                {/* LISTE */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative z-20">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <Search size={18} className="text-slate-400" />
                        <input type="text" placeholder="Trouver une marque..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder-slate-400"/>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {(searchQuery ? filteredData : list).map((item, index) => {
                            const realRank = rankMap.get(item.brand) ?? (data.findIndex(d => d.brand === item.brand) + 1);
                            const roundedScore = Math.round(item.avg_score);
                            const currentTier = getTier(roundedScore);
                            const prevItem = index > 0 ? (searchQuery ? filteredData : list)[index - 1] : null;
                            const prevRoundedScore = prevItem ? Math.round(prevItem.avg_score) : 0;
                            const prevTier = prevItem ? getTier(prevRoundedScore) : null;
                            const showTierHeader = !prevTier || prevTier.label !== currentTier.label;

                            // URLs
                            const brandUrl = `/${toSlug(item.brand)}`;
                            const bestModelUrl = item.best_model ? `/${toSlug(item.brand)}/${toSlug(item.best_famille)}/${item.best_my}/${toSlug(item.best_model)}` : null;
                            const worstModelUrl = item.worst_model ? `/${toSlug(item.brand)}/${toSlug(item.worst_famille)}/${item.worst_my}/${toSlug(item.worst_model)}` : null;

                            return (
                                <div key={item.brand}>
                                    {showTierHeader && (
                                        <div className="bg-slate-50 px-4 py-1.5 flex items-center gap-4 mt-px">
                                            <div className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded border", currentTier.color)}>{currentTier.label}</div>
                                            <div className="h-[1px] bg-slate-200 flex-grow opacity-50"></div>
                                        </div>
                                    )}

                                    <div className="relative group py-3 px-3 md:px-6 flex flex-row items-center gap-3 md:gap-4 hover:bg-blue-50/30 transition-colors">
                                        
                                        {/* Lien Fantôme Marque */}
                                        <Link href={brandUrl} className="absolute inset-0 z-10" aria-label={`Voir la marque ${item.brand}`} />

                                        {/* Rank & Marque */}
                                        <span className="text-base md:text-lg font-bold text-slate-300 w-6 md:w-8 text-center font-mono shrink-0">{realRank}</span>
                                        <div className="flex-grow min-w-0 overflow-hidden relative">
                                            <div className="flex items-baseline gap-2 md:gap-3 mb-0.5">
                                                <h3 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition truncate">{item.brand}</h3>
                                                <span className="text-[10px] md:text-xs font-medium text-slate-400 whitespace-nowrap">{item.review_count} essais</span>
                                            </div>

                                            {/* --- MOBILE ONLY DETAILS --- */}
                                            {item.best_model && (
                                                <div className="md:hidden flex flex-col gap-1 mt-1 relative z-20 pointer-events-none">
                                                    
                                                    {/* LIGNE BEST */}
                                                    <div className="flex items-center gap-1.5 pointer-events-auto">
                                                        <ArrowUp size={10} className="text-emerald-500 shrink-0" strokeWidth={3} />
                                                        <div className="transform scale-[0.6] origin-left -mr-2 shrink-0"><ScoreBadge score={item.best_score || 0} size="sm" /></div>
                                                        {bestModelUrl ? (
                                                            <Link href={bestModelUrl} className="flex items-center gap-1 truncate max-w-full">
                                                                <span className="text-[10px] font-medium text-slate-500 truncate hover:underline">{item.best_model}</span>
                                                                <ExternalLink size={9} className="text-slate-300 shrink-0" />
                                                            </Link>
                                                        ) : (
                                                            <span className="text-[10px] font-medium text-slate-600 truncate">{item.best_model}</span>
                                                        )}
                                                    </div>

                                                    {/* LIGNE WORST */}
                                                    {item.worst_model && (
                                                        <div className="flex items-center gap-1.5 pointer-events-auto">
                                                            <ArrowDown size={10} className="text-red-500 shrink-0" strokeWidth={3} />
                                                            <div className="transform scale-[0.6] origin-left -mr-2 shrink-0"><ScoreBadge score={item.worst_score || 0} size="sm" /></div>
                                                            {worstModelUrl ? (
                                                                <Link href={worstModelUrl} className="flex items-center gap-1 truncate max-w-full">
                                                                    <span className="text-[10px] font-medium text-slate-500 truncate hover:underline">{item.worst_model}</span>
                                                                    <ExternalLink size={9} className="text-slate-300 shrink-0" />
                                                                </Link>
                                                            ) : (
                                                                <span className="text-[10px] font-medium text-slate-400 truncate">{item.worst_model}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* --- DESKTOP ONLY DETAILS --- */}
                                        <div className="flex items-center justify-end gap-4 shrink-0 pl-2 relative z-20 pointer-events-none">
                                            {item.best_model && (
                                                <div className="hidden md:flex flex-col items-start gap-0.5 w-52 lg:w-50 pointer-events-auto">
                                                    
                                                    <div className="flex items-center gap-2 w-full group/best">
                                                        <ArrowUp size={14} className="text-emerald-500 shrink-0" strokeWidth={3} />
                                                        <div className="transform scale-75 origin-center shrink-0"><ScoreBadge score={item.best_score || 0} size="sm" /></div>
                                                        {bestModelUrl ? (
                                                            <Link href={bestModelUrl} className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline truncate flex-1 min-w-0">
                                                                {item.best_model}
                                                            </Link>
                                                        ) : <span>{item.best_model}</span>}
                                                    </div>

                                                    {item.worst_model && (
                                                        <div className="flex items-center gap-2 w-full group/worst">
                                                            <ArrowDown size={14} className="text-red-500 shrink-0" strokeWidth={3} />
                                                            <div className="transform scale-75 origin-center shrink-0"><ScoreBadge score={item.worst_score || 0} size="sm" /></div>
                                                            {worstModelUrl ? (
                                                                <Link href={worstModelUrl} className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline truncate flex-1 min-w-0">
                                                                    {item.worst_model}
                                                                </Link>
                                                            ) : <span>{item.worst_model}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className="pl-2 border-l border-slate-100">
                                                <ScoreBadge score={Math.round(item.avg_score)} size="md" />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </div>
      </main>
    </div>
  );
}
