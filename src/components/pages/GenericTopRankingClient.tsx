"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import ScoreBadge from "@/components/ui/ScoreBadge";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Trophy, Loader2, Search, Crown, CalendarRange, Zap, Leaf, Fuel, Gauge, Cog } from "lucide-react";
import Link from "next/link";

type RankingItem = {
  Marque: string;
  Famille: string;
  MY: number;
  Modele: string;
  avg_score: number;
  review_count: number;
};

type TimeRange = '1y' | '5y' | 'all';

// Props pour configurer la page
type Props = {
  title: string;
  subtitle: string;
  iconType: 'trophy' | 'zap' | 'leaf' | 'fuel' | 'diesel' | 'manual'; // Pour choisir l'icône
  colorTheme: 'blue' | 'green' | 'red' | 'amber' | 'slate' | 'cyan'; // Pour la couleur du header
  filterCategory?: string; // Pour le SQL (ex: 'Électrique')
  filterTransmission?: string; // Pour le SQL (ex: 'M')
};

export default function GenericTopRankingClient({ title, subtitle, iconType, colorTheme, filterCategory, filterTransmission }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('5y');
  const [data, setData] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Mapping des icônes et couleurs
  const icons = {
    trophy: Trophy,
    zap: Zap,
    leaf: Leaf,
    fuel: Fuel,
    diesel: Fuel,
    manual: Cog
  };
  const IconComponent = icons[iconType];

  const themeClasses = {
    blue: "bg-blue-100 text-blue-600",
    cyan: "bg-cyan-100 text-cyan-600",
    green: "bg-lime-100 text-lime-700",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    slate: "bg-slate-200 text-slate-700"
  };

  useEffect(() => {
    async function fetchRanking() {
      setLoading(true);
      
      // --- LOGIQUE MODIFIÉE V2 (MY) ---
      let targetMY: number | null = null;
      const currentYear = new Date().getFullYear();

      // On filtre sur les Années Modèles (MY)
      if (timeRange === '1y') targetMY = currentYear - 1;
      else if (timeRange === '5y') targetMY = currentYear - 5;
      // 'all' reste null

      // --- APPEL RPC V2 ---
      // On passe 'min_my' (int) au lieu de 'min_date' (string)
      const { data: ranking } = await supabase.rpc('get_model_ranking_v2', { 
        min_my: targetMY,
        category_filter: filterCategory || null,
        transmission_filter: filterTransmission || null,
        limit_val: 100 
      });
      
      if (ranking) setData(ranking);
      setLoading(false);
    }
    fetchRanking();
  }, [timeRange, filterCategory, filterTransmission]);

  const filteredData = useMemo(() => {
    return data.filter(item => 
      `${item.Marque} ${item.Modele}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const podium = filteredData.slice(0, 3);
  const list = filteredData.slice(3);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        
        {/* HEADER DYNAMIQUE */}
        <div className="text-center mb-8 md:mb-12">
            <div className={cn("inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-sm", themeClasses[colorTheme])}>
                <IconComponent size={32} />
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-2">
                {title}
            </h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">
                {subtitle}
            </p>
        </div>

        {/* TABS */}
        <div className="flex justify-center mb-12 relative z-20">
            <div className="bg-white p-1 rounded-full border border-slate-200 shadow-sm flex relative">
                <motion.div 
                    layoutId="tab-bg"
                    className="absolute bg-slate-900 rounded-full h-[calc(100%-8px)] top-[4px]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    style={{ left: timeRange === '1y' ? 4 : timeRange === '5y' ? '33.33%' : '66.66%', width: '32%' }}
                />
                {['1y', '5y', 'all'].map((t) => (
                    <button key={t} onClick={() => setTimeRange(t as TimeRange)} className={cn("relative z-10 w-20 md:w-32 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold transition-colors", timeRange === t ? "text-white" : "text-slate-500 hover:text-slate-900")}>
                        {t === '1y' ? '1 an' : t === '5y' ? '5 ans' : 'Toujours'}
                    </button>
                ))}
            </div>
        </div>

        <div className="relative min-h-[400px]">
            {loading && (
                <div className="absolute inset-0 z-30 flex items-start justify-center pt-20 bg-[#f8fafc]/50 backdrop-blur-[1px]">
                    <Loader2 className="animate-spin text-slate-900" size={48} />
                </div>
            )}

            <motion.div
                key={timeRange} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={cn("transition-opacity duration-300", loading ? "opacity-40" : "opacity-100")}
            >
                
                {/* PODIUM */}
                {podium.length === 3 && searchQuery === "" && (
                    <div className="flex items-end justify-center gap-2 md:gap-6 mb-16 h-auto px-2 pt-8 relative z-10">
                        <PodiumStep item={podium[1]} rank={2} />
                        <PodiumStep item={podium[0]} rank={1} />
                        <PodiumStep item={podium[2]} rank={3} />
                    </div>
                )}

                {/* LISTE */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative z-20">
                    
                    <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <Search size={18} className="text-slate-400" />
                        <input type="text" placeholder="Trouver un modèle..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder-slate-400"/>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {(searchQuery ? filteredData : list).map((item, index) => {
                            // Calcul du rang : on trouve l'index réel dans les données complètes
                            // Si on est dans la liste (hors podium), le rang est index + 4. 
                            // Si on recherche, c'est l'index dans filteredData + 1 ? Non, on veut le VRAI rang.
                            // Donc on cherche dans `data`.
                            const realRank = data.findIndex(d => d.Modele === item.Modele && d.MY === item.MY) + 1;

                            return (
                                <div key={`${item.Marque}-${item.Modele}-${item.MY}`}>
                                    <Link 
                                        href={`/${item.Marque}/${item.Famille}/${item.MY}/${item.Modele}`} 
                                        className="group py-3 px-3 md:px-6 flex flex-row items-center gap-3 md:gap-4 hover:bg-blue-50/30 transition-colors cursor-pointer relative overflow-hidden"
                                    >
                                        {/* FILIGRANE MY : right-24 */}
                                        <span className="absolute right-24 top-1/2 -translate-y-1/2 text-6xl font-black text-slate-100 -z-10 select-none pointer-events-none italic tracking-tighter group-hover:text-blue-50 transition-colors">
                                            {item.MY}
                                        </span>

                                        <span className="text-base md:text-lg font-bold text-slate-300 w-6 md:w-8 text-center font-mono shrink-0 relative z-10">{realRank}</span>
                                        
                                        <div className="flex-grow min-w-0 relative z-10">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.Marque}</span>
                                                <span className="text-[10px] font-medium text-slate-400">• {item.review_count} essais</span>
                                            </div>
                                            <h3 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition truncate leading-tight">
                                                {item.Modele}
                                            </h3>
                                        </div>

                                        <div className="flex items-center justify-end gap-4 shrink-0 pl-2 relative z-10">
                                            <div className="pl-2 border-l border-slate-100">
                                                <ScoreBadge score={Math.round(item.avg_score)} size="md" />
                                            </div>
                                        </div>
                                    </Link>
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

function PodiumStep({ item, rank }: { item: RankingItem, rank: number }) {
    const isFirst = rank === 1;
    return (
        <Link href={`/${item.Marque}/${item.Famille}/${item.MY}/${item.Modele}`} className={cn("flex flex-col items-center relative group transition-transform hover:scale-105", isFirst ? "w-1/3 z-10 -mt-8" : "w-1/4 z-0 opacity-90 hover:opacity-100")}>
            {isFirst && <Crown size={32} className="text-yellow-400 mb-2 drop-shadow-sm animate-bounce" />}
            <div className={cn("bg-white border rounded-xl shadow-lg flex flex-col items-center w-full relative overflow-visible", isFirst ? "p-4 border-yellow-400 ring-4 ring-yellow-100" : "p-3 border-slate-200")}>
                <div className={cn("absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm z-20", rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-slate-400" : "bg-orange-400")}>{rank}</div>
                <div className="text-center w-full mt-2">
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{item.Marque}</div>
                    <h3 className={cn("font-black uppercase text-slate-900 truncate w-full leading-tight", isFirst ? "text-sm md:text-lg" : "text-xs md:text-xs")}>{item.Modele}</h3>
                    <span className="text-[10px] font-medium text-slate-400 block mt-1">{item.review_count} essais</span>
                </div>
                <div className="mt-3">
                    <ScoreBadge score={Math.round(item.avg_score)} size={isFirst ? "lg" : "sm"} />
                </div>
                <div className="mt-3 pt-2 border-t border-slate-50 w-full text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Année Modèle</p>
                    <p className="text-xs font-bold text-slate-700">{item.MY}</p>
                </div>
            </div>
            <div className={cn("w-full bg-gradient-to-b from-slate-100 to-transparent rounded-t-lg mt-2", isFirst ? "h-12 md:h-24" : rank === 2 ? "h-8 md:h-16" : "h-4 md:h-10")}></div>
        </Link>
    );
}