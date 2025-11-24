"use client";

import { useState, useMemo } from "react";
import Header from "@/components/Header";
import ScoreBadge from "@/components/ui/ScoreBadge";
import ScoreDistribution from "@/components/dataviz/ScoreDistribution";
import PodiumWidget from "@/components/dataviz/PodiumWidget";
import ReviewsTableCompact from "@/components/tables/ReviewsTableCompact";
import SmartBreadcrumb from "@/components/ui/SmartBreadcrumb";
import { Review } from "@/lib/types";
import { CalendarRange, Gauge, Search, SlidersHorizontal, X, ChevronRight } from "lucide-react"; // Ajout ChevronRight
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type PageLevel = 'family' | 'my' | 'modele' | 'powertrain';

type Props = {
  initialReviews: Review[];
  marque: string;
  famille: string;
  my?: string;
  modele?: string;
  powertrain?: string;
  level: PageLevel;
};

export default function GenericPageClient({ initialReviews, marque, famille, my, modele, powertrain, level }: Props) {
  
  // --- FILTRES ---
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterMY, setFilterMY] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTrans, setFilterTrans] = useState<string>("all");
  const [minPower, setMinPower] = useState<string>("");
  const [maxPower, setMaxPower] = useState<string>("");

  const availableYears = useMemo(() => [...new Set(initialReviews.map(r => r.MY))].sort((a,b) => b-a), [initialReviews]);
  const availableTypes = useMemo(() => [...new Set(initialReviews.map(r => r.Type))].sort(), [initialReviews]);

  const filteredReviews = useMemo(() => {
    return initialReviews.filter(r => {
      const searchStr = `${r.Modele} ${r.Finition || ''} ${r.Testeur}`.toLowerCase();
      if (query && !searchStr.includes(query.toLowerCase())) return false;
      if (filterMY !== "all" && r.MY !== parseInt(filterMY)) return false;
      if (filterType !== "all" && r.Type !== filterType) return false;
      if (filterTrans !== "all") {
        const boite = r.Transmission.slice(-1);
        if (boite !== filterTrans) return false;
      }
      if (minPower && r.Puissance < parseInt(minPower)) return false;
      if (maxPower && r.Puissance > parseInt(maxPower)) return false;
      return true;
    }).sort((a, b) => new Date(b.Test_date).getTime() - new Date(a.Test_date).getTime());
  }, [initialReviews, query, filterMY, filterType, filterTrans, minPower, maxPower]);

  // --- CALCULS STATS ---
  const scores = filteredReviews.map(r => r.Score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const years = filteredReviews.map(r => r.MY).filter(y => y > 0);
  const minYear = years.length ? Math.min(...years) : 0;
  const maxYear = years.length ? Math.max(...years) : 0;
  const powers = filteredReviews.map(r => r.Puissance).filter(p => p > 0);
  const minPowerStat = powers.length ? Math.min(...powers) : 0;
  const maxPowerStat = powers.length ? Math.max(...powers) : 0;

  const clearFilters = () => { setFilterMY("all"); setFilterType("all"); setFilterTrans("all"); setMinPower(""); setMaxPower(""); };
  const activeFiltersCount = (filterMY !== "all" ? 1 : 0) + (filterType !== "all" ? 1 : 0) + (filterTrans !== "all" ? 1 : 0) + (minPower || maxPower ? 1 : 0);
  const isFiltered = activeFiltersCount > 0 || query !== "";

  // --- TITRE DYNAMIQUE ---
  const getPageTitle = () => {
    if (level === 'powertrain') return `${my} ${modele}`;
    if (level === 'modele') return `${my} ${modele}`; 
    if (level === 'my') return `${my} ${famille}`;
    return famille;
  };

  // --- SOUS-TITRE POWERTRAIN ---
  const getPowertrainSubtitle = () => {
    if (level !== 'powertrain' || !powertrain) return null;
    
    // Décodage du slug : Essence_525_7A
    const parts = powertrain.split('_');
    const trans = parts.pop(); // 7A
    const power = parts.pop(); // 525 (On l'ignore ici)
    const type = parts.join(' '); // Essence (ou Hybride essence)
    
    return (
      <span className="block text-xl md:text-2xl font-medium text-slate-400 mt-1 tracking-wide">
        {type} <span className="text-slate-600 mx-2">•</span> {trans}
      </span>
    );
  };

  
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main>
        {/* HERO */}
        <section className="bg-slate-900 text-white pt-12 pb-24 px-4 relative overflow-hidden transition-all duration-500">
            {/* ... Background ... */}
            <div className="max-w-7xl mx-auto relative z-10">
                
                <SmartBreadcrumb marque={marque} famille={famille} my={my} modele={modele} powertrain={powertrain} />

                <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
                    <div className="shrink-0">
                        <ScoreBadge score={avgScore} size="xl" isFiltered={isFiltered} reviewCount={filteredReviews.length} />
                    </div>
                    <div className="flex-grow pb-1">
                        
                        {/* MARQUE + CHEVRON */}
                        <div className="text-lg md:text-xl font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                           {marque}
                           <ChevronRight size={16} className="text-slate-700" strokeWidth={3} />
                        </div>
                        
                        {/* TITRE PRINCIPAL */}
                        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none text-white">
                            {getPageTitle()}
                        </h1>

                        {/* SOUS-TITRE POWERTRAIN (Nouveau) */}
                        {/* S'affiche uniquement si on est au niveau powertrain */}
                        {getPowertrainSubtitle()}
                        
                        {/* TAGS (Marge top ajustée si sous-titre présent ou non) */}
                        <motion.div layout className={cn("flex flex-wrap gap-6 text-sm font-medium text-slate-300", level === 'powertrain' ? "mt-6" : "mt-6")}>
                            
                            {/* BLOC ANNÉES */}
                            <div className={cn("flex items-center gap-2", level !== 'family' && "invisible")}>
                                <CalendarRange className="text-slate-500" size={18} />
                                <span className="text-slate-300">{minYear === maxYear ? minYear : `${minYear} - ${maxYear}`}</span>
                            </div>

                            {/* BLOC PUISSANCE */}
                            <div className="flex items-center gap-2">
                                <Gauge className="text-slate-500" size={18} />
                                <span className="text-slate-300">{minPowerStat === maxPowerStat ? `${minPowerStat} ch` : `${minPowerStat} - ${maxPowerStat} ch`}</span>
                            </div>

                            {/* BLOC ESSAIS */}
                            <div className="flex items-center gap-2">
                                <motion.div key={filteredReviews.length} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase border transition-colors duration-300", isFiltered ? "bg-slate-900 text-orange-500 border-orange-500" : "bg-slate-800 text-slate-400 border-slate-700")}>
                                    {filteredReviews.length} Essais
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>

        {/* CONTENT GRID */}
        <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-20 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* GAUCHE */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col sm:flex-row gap-3">
                        
                        {/* BARRE DE RECHERCHE (Reste toujours visible) */}
                        <div className="relative flex-grow group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-slate-400 group-focus-within:text-blue-500 transition" />
                            </div>
                            <input 
                                type="text" 
                                value={query} 
                                onChange={(e) => setQuery(e.target.value)} 
                                placeholder="Filtrer (ex: GT3, Top Gear...)" 
                                className="pl-10 pr-4 py-2 w-full bg-slate-50 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
                            />
                            {query && (
                                <button onClick={() => setQuery("")} className="absolute inset-y-0 right-0 pr-3 text-slate-400 hover:text-slate-600">
                                    <X size={14}/>
                                </button>
                            )}
                        </div>

                        {/* BOUTON FILTRES : MASQUÉ SI PAGE POWERTRAIN */}
                        {level !== 'powertrain' && (
                            <button 
                                onClick={() => setShowFilters(!showFilters)} 
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase border transition select-none", 
                                    showFilters || activeFiltersCount > 0 
                                        ? "bg-slate-900 text-white border-slate-900" 
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                )}
                            >
                                <SlidersHorizontal size={16} />
                                <span>Filtres</span>
                                {activeFiltersCount > 0 && (
                                    <span className="ml-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>
                        )}

                    </div>
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="pt-4 mt-2 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    
                                    {/* LOGIQUE DE MASQUAGE INTELLIGENTE */}
                                    {/* On cache MY si niveau >= my */}
                                    {level !== 'my' && level !== 'modele' && level !== 'powertrain' && (
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">MY</label><select value={filterMY} onChange={(e) => setFilterMY(e.target.value)} className="w-full text-xs font-bold border-slate-200 rounded bg-slate-50 p-1.5"><option value="all">Tous</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                                    )}
                                    
                                    {/* On cache les filtres techniques si on est sur une page Powertrain (car c'est déjà filtré) */}
                                    {level !== 'powertrain' && (
                                      <>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Moteur</label><select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full text-xs font-bold border-slate-200 rounded bg-slate-50 p-1.5"><option value="all">Tous</option>{availableTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Boîte</label><div className="flex bg-slate-50 rounded border border-slate-200 p-0.5"><button onClick={() => setFilterTrans("all")} className={cn("flex-1 text-[10px] font-bold py-1 rounded", filterTrans === "all" ? "bg-white shadow-sm" : "text-slate-400")}>TOUT</button><button onClick={() => setFilterTrans("M")} className={cn("flex-1 text-[10px] font-bold py-1 rounded", filterTrans === "M" ? "bg-white shadow-sm" : "text-slate-400")}>MANU</button><button onClick={() => setFilterTrans("A")} className={cn("flex-1 text-[10px] font-bold py-1 rounded", filterTrans === "A" ? "bg-white shadow-sm" : "text-slate-400")}>AUTO</button></div></div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Puissance</label><div className="flex gap-1"><input type="number" placeholder="Min" value={minPower} onChange={(e) => setMinPower(e.target.value)} className="w-full text-xs border-slate-200 rounded bg-slate-50 p-1.5"/><input type="number" placeholder="Max" value={maxPower} onChange={(e) => setMaxPower(e.target.value)} className="w-full text-xs border-slate-200 rounded bg-slate-50 p-1.5"/></div></div>
                                      </>
                                    )}

                                </div>
                                {activeFiltersCount > 0 && <div className="flex justify-end pt-2"><button onClick={clearFilters} className="text-xs font-bold text-red-500 uppercase flex items-center gap-1"><X size={12}/> Effacer filtres</button></div>}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <ReviewsTableCompact data={filteredReviews} />
            </div>

            {/* DROITE */}
            <div className="space-y-6">
                <motion.div layout><ScoreDistribution scores={scores} /></motion.div>
                
                <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-bold text-lg mb-2">Comparer</h3>
                    <p className="text-slate-400 text-sm mb-4">Lancez un duel technique.</p>
                    <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold uppercase text-sm transition">Lancer le comparateur</button>
                </div>

                {/* Le podium est caché si level == 'modele' OU 'powertrain' */}
                {level !== 'modele' && level !== 'powertrain' && (
                    <motion.div layout>
                        <PodiumWidget reviews={filteredReviews} />
                    </motion.div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}