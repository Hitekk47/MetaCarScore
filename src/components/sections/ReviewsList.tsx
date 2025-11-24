"use client";

import { useState, useMemo } from "react";
import ReviewsTableCompact from "../tables/ReviewsTableCompact";
import { Review } from "@/lib/types";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SortOption = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc' | 'power_desc';

export default function ReviewsList({ reviews }: { reviews: Review[] }) {
  // --- ÉTATS DES FILTRES ---
  const [query, setQuery] = useState(""); // Recherche textuelle (Modèle, Finition, Testeur)
  const [showFilters, setShowFilters] = useState(false); // Toggle du panneau
  
  // Filtres techniques
  const [filterMY, setFilterMY] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTrans, setFilterTrans] = useState<string>("all"); // 'A' | 'M' | 'all'
  const [minPower, setMinPower] = useState<string>(""); // String pour input, converti en number
  const [maxPower, setMaxPower] = useState<string>("");

  // Tri
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  // --- LISTES DÉROULANTES DYNAMIQUES (Basées sur les données présentes) ---
  // On ne propose que les années ou types qui existent vraiment dans cette liste
  const availableYears = useMemo(() => [...new Set(reviews.map(r => r.MY))].sort((a,b) => b-a), [reviews]);
  const availableTypes = useMemo(() => [...new Set(reviews.map(r => r.Type))].sort(), [reviews]);

  // --- MOTEUR DE FILTRAGE (Le Cœur) ---
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      // 1. Recherche Textuelle (Insensible casse, cherche dans Modèle, Finition, Testeur)
      const searchStr = `${r.Modele} ${r.Finition || ''} ${r.Testeur}`.toLowerCase();
      if (query && !searchStr.includes(query.toLowerCase())) return false;

      // 2. Filtre MY
      if (filterMY !== "all" && r.MY !== parseInt(filterMY)) return false;

      // 3. Filtre Type (Moteur)
      if (filterType !== "all" && r.Type !== filterType) return false;

      // 4. Filtre Transmission (Dernier caractère : 'A' ou 'M')
      if (filterTrans !== "all") {
        const boite = r.Transmission.slice(-1); // "6M" -> "M"
        if (boite !== filterTrans) return false;
      }

      // 5. Filtre Puissance
      if (minPower && r.Puissance < parseInt(minPower)) return false;
      if (maxPower && r.Puissance > parseInt(maxPower)) return false;

      return true;
    }).sort((a, b) => {
      // LOGIQUE DE TRI
      switch (sortBy) {
        case 'date_desc': return new Date(b.Test_date).getTime() - new Date(a.Test_date).getTime();
        case 'date_asc': return new Date(a.Test_date).getTime() - new Date(b.Test_date).getTime();
        case 'score_desc': return b.Score - a.Score;
        case 'score_asc': return a.Score - b.Score;
        case 'power_desc': return b.Puissance - a.Puissance;
        default: return 0;
      }
    });
  }, [reviews, query, filterMY, filterType, filterTrans, minPower, maxPower, sortBy]);

  // Reset des filtres avancés
  const clearFilters = () => {
    setFilterMY("all");
    setFilterType("all");
    setFilterTrans("all");
    setMinPower("");
    setMaxPower("");
  };

  const activeFiltersCount = (filterMY !== "all" ? 1 : 0) + (filterType !== "all" ? 1 : 0) + (filterTrans !== "all" ? 1 : 0) + (minPower || maxPower ? 1 : 0);

  return (
    <section>
      
      {/* --- HEADER & BARRE D'OUTILS --- */}
      <div className="flex flex-col gap-4 mb-6">
        
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
            Tous les essais
            </h2>
             {/* Compteur Mobile/Desktop */}
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {filteredReviews.length} / {reviews.length}
            </div>
        </div>

        {/* BARRE DE CONTROLE */}
        <div className="flex flex-col sm:flex-row gap-3">
            
            {/* 1. RECHERCHE TEXTE (Large) */}
            <div className="relative flex-grow group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-slate-400 group-focus-within:text-blue-500 transition" />
                </div>
                <input 
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)} 
                    placeholder="Filtrer par modèle, finition, testeur..." 
                    className="pl-10 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"
                />
                {query && (
                    <button onClick={() => setQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* 2. BOUTON FILTRES TECHNIQUES */}
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide border transition shadow-sm select-none",
                    showFilters || activeFiltersCount > 0
                        ? "bg-slate-900 text-white border-slate-900" 
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
            >
                <SlidersHorizontal size={16} />
                <span className="hidden sm:inline">Filtres</span>
                {activeFiltersCount > 0 && (
                    <span className="ml-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                        {activeFiltersCount}
                    </span>
                )}
            </button>

            {/* 3. TRI (Dropdown simple) */}
            <div className="relative">
                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg text-sm font-bold uppercase tracking-wide focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer shadow-sm w-full sm:w-auto"
                >
                    <option value="date_desc">Récent</option>
                    <option value="date_asc">Ancien</option>
                    <option value="score_desc">Meilleur Score</option>
                    <option value="score_asc">Pire Score</option>
                    <option value="power_desc">Puissance</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                    {sortBy.includes('desc') ? <ArrowDownWideNarrow size={14}/> : <ArrowUpWideNarrow size={14}/>}
                </div>
            </div>

        </div>

        {/* --- PANNEAU FILTRES AVANCÉS (Expandable) --- */}
        {showFilters && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
                
                {/* MY */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Année Modèle (MY)</label>
                    <select value={filterMY} onChange={(e) => setFilterMY(e.target.value)} className="w-full text-sm font-medium border-slate-200 rounded-md focus:ring-blue-500 bg-white p-2">
                        <option value="all">Toutes les années</option>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                {/* TYPE */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motorisation</label>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full text-sm font-medium border-slate-200 rounded-md focus:ring-blue-500 bg-white p-2">
                        <option value="all">Tous types</option>
                        {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                {/* TRANSMISSION */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Boîte de vitesse</label>
                    <div className="flex bg-white rounded-md border border-slate-200 p-1">
                        <button onClick={() => setFilterTrans("all")} className={cn("flex-1 text-xs font-bold py-1.5 rounded transition", filterTrans === "all" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}>TOUT</button>
                        <button onClick={() => setFilterTrans("M")} className={cn("flex-1 text-xs font-bold py-1.5 rounded transition", filterTrans === "M" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}>MANU</button>
                        <button onClick={() => setFilterTrans("A")} className={cn("flex-1 text-xs font-bold py-1.5 rounded transition", filterTrans === "A" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}>AUTO</button>
                    </div>
                </div>

                {/* PUISSANCE */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Puissance (ch)</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" placeholder="Min" value={minPower} onChange={(e) => setMinPower(e.target.value)}
                            className="w-full text-sm font-medium border-slate-200 rounded-md focus:ring-blue-500 p-2 bg-white"
                        />
                        <span className="text-slate-400">-</span>
                        <input 
                            type="number" placeholder="Max" value={maxPower} onChange={(e) => setMaxPower(e.target.value)}
                            className="w-full text-sm font-medium border-slate-200 rounded-md focus:ring-blue-500 p-2 bg-white"
                        />
                    </div>
                </div>

                {/* BOUTON RESET (Si filtres actifs) */}
                {activeFiltersCount > 0 && (
                    <div className="sm:col-span-2 md:col-span-4 flex justify-end pt-2 border-t border-slate-200 mt-2">
                        <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wide flex items-center gap-1">
                            <X size={12} /> Réinitialiser les filtres
                        </button>
                    </div>
                )}
            </div>
        )}

      </div>
      
      {/* --- RÉSULTATS --- */}
      {filteredReviews.length > 0 ? (
        <ReviewsTableCompact data={filteredReviews} />
      ) : (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200 flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <SlidersHorizontal size={24} />
            </div>
            <p className="text-slate-900 font-bold text-lg">Aucun résultat</p>
            <p className="text-slate-500 text-sm mb-4">Essayez de modifier vos filtres ou votre recherche.</p>
            <button onClick={() => { setQuery(""); clearFilters(); }} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase rounded hover:bg-slate-700 transition">
                Tout effacer
            </button>
        </div>
      )}
    </section>
  );
}