"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, ChevronRight, CarFront, Library } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

type SearchResult = {
  Marque: string;
  Famille: string;
  Modele: string | null;
  Type: 'family' | 'model';
};

interface SearchBarProps {
  placeholder?: string;
  variant?: "hero" | "header";
  className?: string;
}

export default function SearchBar({ placeholder, variant = "header", className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // CLIC EXTÉRIEUR
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // TOUCHE ESCAPE
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // RECHERCHE (Appel V3)
  useEffect(() => {
    async function fetchResults() {
      if (debouncedQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      setIsOpen(true);

      // --- MODIFICATION ICI : Appel de la V3 ---
      const { data, error } = await supabase
        .rpc('search_cars_v6', { search_term: debouncedQuery });

      if (data) {
        setResults(data as SearchResult[]);
      } else {
        console.error(error);
        setResults([]);
      }
      
      setLoading(false);
    }

    fetchResults();
  }, [debouncedQuery]);

  const isHero = variant === "hero";

  const handleSelect = (res: SearchResult) => {
    if (res.Type === 'family') {
      console.log(`Navigation vers FAMILLE : /${res.Marque}/${res.Famille}`);
    } else {
      console.log(`Navigation vers MODELE : /${res.Marque}/${res.Famille}/${res.Modele}`);
    }
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={cn("relative group w-full", className)}>
      
      {/* INPUT */}
      <div className={cn(
        "relative flex items-center transition-all duration-300",
        isHero ? "bg-white rounded-full p-2 shadow-2xl hover:scale-[1.01]" : "bg-slate-100 rounded-full"
      )}>
        <div className={cn("text-slate-400 flex items-center justify-center", isHero ? "pl-6" : "pl-3")}>
          {loading ? <Loader2 className="animate-spin" size={isHero ? 24 : 14} /> : <Search size={isHero ? 24 : 14} />}
        </div>

        <input 
          ref={inputRef}
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if(results.length > 0) setIsOpen(true); }}
          placeholder={placeholder || "Rechercher..."} 
          className={cn(
            "w-full bg-transparent border-none text-slate-900 font-medium focus:ring-0 placeholder-slate-400",
            isHero ? "text-lg px-4 py-3" : "text-sm px-3 py-1.5"
          )}
        />
        
        {isHero && <button className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider text-sm hover:bg-blue-600 transition shadow-lg shrink-0 hidden sm:block">Chercher</button>}
      </div>

      {/* DROPDOWN */}
      {isOpen && results.length > 0 && (
        <div className={cn(
          "absolute left-0 w-full bg-white border border-slate-200 shadow-xl overflow-hidden z-50 mt-2 text-left",
          isHero ? "top-full rounded-2xl" : "top-full rounded-xl"
        )}>
          <div className="py-2">
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1 flex justify-between">
              <span>Résultats</span>
              <span className="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 border border-slate-200">ESC pour fermer</span>
            </div>
            
            {results.map((res, idx) => {
              const isFamily = res.Type === 'family';

              return (
                <div 
                  key={`${res.Type}-${res.Marque}-${res.Famille}-${res.Modele || idx}`}
                  onClick={() => handleSelect(res)}
                  className={cn(
                    "px-4 py-3 cursor-pointer flex items-center justify-between group/item transition-colors border-b border-slate-50 last:border-0",
                    isFamily ? "bg-slate-50/50 hover:bg-blue-50" : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden"> {/* overflow-hidden pour gérer les noms très longs */}
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center transition shrink-0", // shrink-0 empêche l'icône de s'écraser
                        isFamily 
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-400 group-hover/item:text-blue-600 group-hover/item:border-blue-200"
                      )}>
                          {isFamily ? <Library size={16} /> : <CarFront size={16} />}
                      </div>
                      
                      <div className="truncate"> {/* truncate pour couper le texte s'il est trop long */}
                          {isFamily ? (
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Famille</span>
                                <span className="font-black text-slate-900 text-sm uppercase truncate">
                                    {res.Marque} {res.Famille}
                                </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-500 truncate">
                                    {res.Marque} {res.Famille}
                                </span>
                                <span className="font-bold text-slate-900 text-sm uppercase truncate">
                                    {res.Modele}
                                </span>
                            </div>
                          )}
                      </div>
                  </div>
                  
                  {/* CHEVRON OU BADGE */}
                  <div className="pl-2 shrink-0"> {/* shrink-0 pour protéger le badge */}
                    {isFamily ? (
                      <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 group-hover/item:text-blue-600 group-hover/item:border-blue-200 transition whitespace-nowrap">
                          Voir la gamme
                      </span>
                    ) : (
                      <ChevronRight size={14} className="text-slate-300 group-hover/item:text-blue-600 transition" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}