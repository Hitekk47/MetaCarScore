"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import ScoreBadge from "@/components/ui/ScoreBadge";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Trophy, Loader2, Search, Zap, Leaf, Fuel, Cog, Luggage, Sun, Info } from "lucide-react";
import Link from "next/link";
import { toSlug } from "@/lib/slugify";
import { ModelRankingItem } from "@/lib/types";
import ModelPodiumStep from "@/components/ranking/ModelPodiumStep";

// --- TYPES ---
type TimeRange = '1y' | '5y' | 'all';

type RpcParams = {
  min_my: number | null;
  limit_val: number;
  category_filter?: string | null;
  transmission_filter?: string | null;
  macro_category_filter?: string | null;
  segment_filter?: string | null;
};

// --- CONFIGURATION NOMENCLATURE ---
type SegmentDef = { code: string; label: string };

const MACRO_CONFIG: { label: string; segments: SegmentDef[] }[] = [
  { 
    label: "Berline / Hatch", 
    segments: [
      { code: "A", label: "Micro-Citadines" },  // Twingo, Panda
      { code: "B", label: "Citadines" },        // Clio, 208
      { code: "C", label: "Compactes" },        // Golf, 308
      { code: "D", label: "Berlines Familiales" }, // Passat, Model 3
      { code: "E", label: "Routières / Luxe" }, // Série 5, Classe E
      { code: "F", label: "Limousines" }        // Série 7, Classe S
    ] 
  },
  { 
    label: "SUV / Crossover", 
    segments: [
      { code: "A", label: "Micro-SUV" },     // Ignis
      { code: "B", label: "SUV Urbains" },   // 2008, Captur
      { code: "C", label: "SUV Compacts" },  // 3008, Tiguan
      { code: "D", label: "SUV Familiaux" }, // X3, GLC
      { code: "E", label: "Grands SUV Luxe" }, // X5, Cayenne
      { code: "F", label: "SUV Prestige" }   // Range Rover, Bentayga
    ] 
  },
  { 
    label: "Sport / Coupé / Cab", 
    segments: [
      { code: "SPORT", label: "Sportives Light" }, // MX-5, Alpine
      { code: "GT", label: "Grand Tourisme" },     // 911, AMG GT
      { code: "SUPER", label: "Supercars" }        // Ferrari, McLaren
    ] 
  },
  { 
    label: "Familiale / Van", 
    segments: [
      { code: "B", label: "Ludospaces" },          // Kangoo, Berlingo
      { code: "C", label: "Monospaces Compacts" }, // Scénic, Touran
      { code: "D", label: "Grands Monospaces" },   // Espace, Sharan
      { code: "E", label: "Vans VIP / Navettes" }  // Classe V, Multivan
    ] 
  },
  { 
    label: "Utilitaire / Pickup", 
    segments: [
      { code: "C", label: "Compact / City" },    // Kangoo, Caddy
      { code: "D", label: "Moyen / 1 Tonne" },     // Ranger, Hilux, Amarok, Trafic
      { code: "E", label: "Grand / Full Size" }    // F-150, RAM, Crafter
    ] 
  }
];

type Props = {
  title: string;
  subtitle: string;
  iconType: 'trophy' | 'zap' | 'leaf' | 'fuel' | 'diesel' | 'manual' | 'luggage' | 'sun'; 
  colorTheme: 'blue' | 'green' | 'red' | 'amber' | 'slate' | 'cyan'| 'orange';
  filterCategory?: string; 
  filterTransmission?: string;
  customRpcName?: string;
};

export default function GenericTopRankingClient({ 
  title, 
  subtitle, 
  iconType, 
  colorTheme, 
  filterCategory, 
  filterTransmission,
  customRpcName
}: Props) {
  
  // --- STATE ---
  const [timeRange, setTimeRange] = useState<TimeRange>('5y');
  const [data, setData] = useState<ModelRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeMacro, setActiveMacro] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const icons = {
    trophy: Trophy, zap: Zap, leaf: Leaf, fuel: Fuel, diesel: Fuel, 
    manual: Cog, luggage: Luggage, sun: Sun
  };
  const IconComponent = icons[iconType] || Trophy;

  const themeClasses = {
    blue: "bg-blue-100 text-blue-600",
    cyan: "bg-cyan-100 text-cyan-600",
    green: "bg-lime-100 text-lime-700",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    slate: "bg-slate-200 text-slate-700",
    orange: "bg-orange-100 text-orange-600",
  };

  // --- FETCH DATA ---
  useEffect(() => {
    async function fetchRanking() {
      setLoading(true);
      
      let targetMY: number | null = null;
      const currentYear = new Date().getFullYear();

      if (timeRange === '1y') targetMY = currentYear - 1;
      else if (timeRange === '5y') targetMY = currentYear - 5;

      const rpcName = customRpcName || 'get_model_ranking_v3';
      const rpcParams: RpcParams = { min_my: targetMY, limit_val: 100 };

      if (!customRpcName) {
        rpcParams.category_filter = filterCategory || null; 
        rpcParams.transmission_filter = filterTransmission || null;
        rpcParams.macro_category_filter = activeMacro || null;
        rpcParams.segment_filter = activeSegment || null;
      }

      const { data: ranking } = await supabase.rpc(rpcName, rpcParams);
      if (ranking) setData(ranking);
      setLoading(false);
    }
    fetchRanking();
  }, [timeRange, filterCategory, filterTransmission, customRpcName, activeMacro, activeSegment]);

  // --- HANDLERS ---
  const handleMacroClick = (label: string) => {
    if (activeMacro === label) {
      setActiveMacro(null);
      setActiveSegment(null);
    } else {
      setActiveMacro(label);
      setActiveSegment(null);
    }
  };

  const handleSegmentClick = (segCode: string) => {
    setActiveSegment(prev => prev === segCode ? null : segCode);
  };

  const currentMacroConfig = MACRO_CONFIG.find(m => m.label === activeMacro);

  // --- LOGIQUE D'AFFICHAGE (PODIUM vs LISTE) ---
  const filteredData = useMemo(() => {
    return data.filter(item => 
      `${item.Marque} ${item.Modele}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  // CORRECTION CRITIQUE : Si moins de 3 résultats, pas de podium, tout en liste.
  const showPodium = filteredData.length >= 3 && searchQuery === "";
  
  const podium = showPodium ? filteredData.slice(0, 3) : [];
  const list = showPodium ? filteredData.slice(3) : filteredData;


  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        
        {/* HEADER */}
        <div className="text-center mb-8 md:mb-10">
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

        {/* --- ZONE DE FILTRES --- */}
{/* --- ZONE DE FILTRES (COMPACTE) --- */}
        <div className="mb-8 relative z-30 space-y-4">
            
            {/* 1. TABS TEMPORELS */}
            <div className="flex justify-center">
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

            {/* 2. FILTRES MACRO & SEGMENTS */}
            {!customRpcName && (
              <div className="flex flex-col items-center gap-3">
                  
                  {/* NIVEAU 1 : MACRO (Taille unifiée avec TimeRange) */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {MACRO_CONFIG.map((macro) => {
                      const isActive = activeMacro === macro.label;
                      return (
                        <button
                          key={macro.label}
                          onClick={() => handleMacroClick(macro.label)}
                          className={cn(
                            // MODIF: Padding réduit (px-3 py-1.5) et Text réduit (text-xs md:text-sm)
                            "px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold border transition-all duration-300",
                            isActive 
                              ? "bg-slate-900 text-white border-slate-900 shadow-md scale-105"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
                          )}
                        >
                          {macro.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* NIVEAU 2 : SEGMENTS (Version Compacte) */}
                  <AnimatePresence mode="wait">
                    {activeMacro && currentMacroConfig && (
                      <motion.div 
                        key={activeMacro}
                        initial={{ opacity: 0, height: 0, y: -5 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -5 }}
                        className="overflow-hidden w-full flex flex-col items-center"
                      >
                         {/* LABEL DE GUIDAGE (Plus petit) */}
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2 mt-1">
                           <Info size={10} />
                           Filtrer par segment
                        </div>

                        {/* CONTAINER SEGMENTS (Paddings réduits) */}
                        <div className="flex flex-wrap justify-center gap-1.5 max-w-4xl px-2 py-1.5 bg-slate-50/50 rounded-xl border border-slate-100">
                            {currentMacroConfig.segments.map((seg) => {
                                const isActive = activeSegment === seg.code;
                                
                                return (
                                    <button
                                      key={seg.code}
                                      onClick={() => handleSegmentClick(seg.code)}
                                      className={cn(
                                        // MODIF: Padding ultra compact
                                        "pl-1 pr-2.5 py-1 rounded-full text-[10px] md:text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5 shadow-sm select-none",
                                        isActive
                                          ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-1 ring-blue-100"
                                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 hover:shadow"
                                      )}
                                    >
                                      {/* CODE TECHNIQUE (Cercle réduit h-5 w-auto) */}
                                      <span className={cn(
                                          "min-w-[20px] px-1 h-5 flex items-center justify-center rounded-full text-[9px] font-bold", 
                                          isActive ? "bg-white text-blue-600" : "bg-slate-100 text-slate-500"
                                      )}>
                                        {seg.code.replace('SUV-', '')}
                                      </span>
                                      
                                      <span>{seg.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
              </div>
            )}
        </div>

        {/* --- RESULTATS --- */}
        <div className="relative min-h-[400px]">
            {loading && (
                <div className="absolute inset-0 z-30 flex items-start justify-center pt-20 bg-[#f8fafc]/50 backdrop-blur-[1px]">
                    <Loader2 className="animate-spin text-slate-900" size={48} />
                </div>
            )}

            <motion.div
                key={`${timeRange}-${activeMacro}-${activeSegment}`} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={cn("transition-opacity duration-300", loading ? "opacity-40" : "opacity-100")}
            >
                
                {/* PODIUM (Uniquement si >= 3 résultats) */}
                {showPodium && (
                    <div className="flex items-end justify-center gap-1 md:gap-6 mb-16 h-auto pt-8 relative z-10 max-w-2xl mx-auto">
                        <ModelPodiumStep item={podium[1]} rank={2} />
                        <ModelPodiumStep item={podium[0]} rank={1} />
                        <ModelPodiumStep item={podium[2]} rank={3} />
                    </div>
                )}
                
                {/* EMPTY STATE */}
                {data.length === 0 && !loading && (
                    <div className="text-center py-20 text-slate-400">
                        <Search size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">Aucun véhicule ne correspond à ces critères.</p>
                        <button onClick={() => {setActiveMacro(null); setActiveSegment(null);}} className="mt-4 text-blue-600 font-bold hover:underline">
                            Réinitialiser les filtres
                        </button>
                    </div>
                )}

                {/* LISTE (Affiche TOUT si pas de podium) */}
                {data.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative z-20">
                        
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                            <Search size={18} className="text-slate-400" />
                            <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder-slate-400"/>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {(searchQuery ? filteredData : list).map((item) => {
                                const realRank = data.findIndex(d => d.Modele === item.Modele && d.MY === item.MY) + 1;

                                return (
                                    <div key={`${item.Marque}-${item.Modele}-${item.MY}`}>
                                        <Link 
                                            href={`/${toSlug(item.Marque)}/${toSlug(item.Famille)}/${item.MY}/${toSlug(item.Modele)}`} 
                                            className="group py-3 px-3 md:px-6 flex flex-row items-center gap-3 md:gap-4 hover:bg-blue-50/30 transition-colors cursor-pointer relative overflow-hidden"
                                        >
                                            <span className="absolute right-24 top-1/2 -translate-y-1/2 text-6xl font-black text-slate-100 -z-10 select-none pointer-events-none italic tracking-tighter group-hover:text-blue-50 transition-colors">
                                                {item.MY}
                                            </span>

                                            <span className="text-base md:text-lg font-bold text-slate-300 w-6 md:w-8 text-center font-mono shrink-0 relative z-10">{realRank}</span>
                                            
                                            <div className="flex-grow min-w-0 relative z-10">
                                                <div className="flex items-baseline gap-2 mb-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.Marque}</span>
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
                )}
            </motion.div>
        </div>
      </main>
    </div>
  );
}
