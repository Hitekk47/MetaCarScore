"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { Search, Loader2, History, LayoutGrid, X } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useRouter } from "next/navigation";
import { toSlug } from "@/lib/slugify";
import { SearchResult } from "@/lib/types";
import ResultItem from "./ResultItem";
import { SEARCH_PLACEHOLDERS } from "@/lib/constants";

// --- MCS SEARCH HISTORY STORE ---

const listeners = new Set<() => void>();
const emitHistoryChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

const EMPTY_ARRAY: SearchResult[] = [];
let cachedHistory: SearchResult[] = EMPTY_ARRAY;
let cachedRaw: string | null = null;

const historyStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "mcs_search_history") {
        cachedRaw = null;
        listener();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", handleStorage);
    };
  },
  getSnapshot() {
    if (typeof window === "undefined") return EMPTY_ARRAY;
    try {
      const raw = localStorage.getItem("mcs_search_history");
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedHistory = raw ? JSON.parse(raw) : EMPTY_ARRAY;
      }
      return cachedHistory;
    } catch {
      return EMPTY_ARRAY;
    }
  },
  getServerSnapshot() {
    return EMPTY_ARRAY;
  },
  set(newHistory: SearchResult[]) {
    try {
      const raw = JSON.stringify(newHistory);
      localStorage.setItem("mcs_search_history", raw);
      cachedRaw = raw;
      cachedHistory = newHistory;
    } catch (e) {
      console.error(e);
    }
    emitHistoryChange();
  }
};

// --- CONFIGURATION TYPEWRITER ---

interface SearchBarProps {
  placeholder?: string;
  variant?: "hero" | "header";
  className?: string;
  onSelect?: (res: SearchResult) => void;
  modelOnly?: boolean; 
}

export default function SearchBar({ placeholder, variant = "header", className, onSelect, modelOnly = false}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const history = useSyncExternalStore(
    historyStore.subscribe,
    historyStore.getSnapshot,
    historyStore.getServerSnapshot
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const [prevResults, setPrevResults] = useState(results);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (results !== prevResults || isOpen !== prevIsOpen) {
    setPrevResults(results);
    setPrevIsOpen(isOpen);
    setSelectedIndex(-1);
  }
  
  // État pour le placeholder animé
  const [placeholderText, setPlaceholderText] = useState(placeholder || "Rechercher...");

  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHero = variant === "hero";

  // --- EFFET TYPEWRITER (Uniquement pour Hero) ---
  useEffect(() => {
    if (!isHero) return; // Pas d'animation dans le header

    let currentStringIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    const type = () => {
      const currentString = SEARCH_PLACEHOLDERS[currentStringIndex];

      // Déterminer le texte à afficher
      if (isDeleting) {
        setPlaceholderText(currentString.substring(0, currentCharIndex - 1));
        currentCharIndex--;
      } else {
        setPlaceholderText(currentString.substring(0, currentCharIndex + 1));
        currentCharIndex++;
      }

      // Vitesse de frappe
      let typeSpeed = isDeleting ? 40 : 80; // Efface plus vite qu'il n'écrit

      // Logique de fin de mot / fin d'effacement
      if (!isDeleting && currentCharIndex === currentString.length) {
        // Mot complet : on attend 2 secondes avant d'effacer
        typeSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && currentCharIndex === 0) {
        // Mot effacé : on passe au suivant
        isDeleting = false;
        currentStringIndex = (currentStringIndex + 1) % SEARCH_PLACEHOLDERS.length;
        typeSpeed = 500; // Petite pause avant de recommencer à écrire
      }

      timeoutId = setTimeout(type, typeSpeed);
    };

    // Démarrage
    type();

    return () => clearTimeout(timeoutId);
  }, [isHero]); // Se lance au montage si isHero est true

  // --- LOGIQUE EXISTANTE ---

  const addToHistory = (item: SearchResult) => {
    const newHistory = [item, ...history.filter(h => 
      !(h.Marque === item.Marque && h.Famille === item.Famille && h.Modele === item.Modele)
    )].slice(0, 5);
    historyStore.set(newHistory);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const activeList = (results.length > 0) ? results : (query.length === 0 ? history : []);
    if (activeList.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < activeList.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : activeList.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < activeList.length) {
        handleSelect(activeList[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchResults() {
      if (debouncedQuery.length === 0) {
        setResults([]);
        if (history.length > 0 && document.activeElement === inputRef.current) {
           setIsOpen(true); 
        }
        // --------------------
        return;
      }
      
      if (debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      setIsOpen(true);

      const { data, error } = await supabase
        .rpc('search_cars_v14', { search_term: debouncedQuery });

      if (data) {
        let finalResults = data as SearchResult[];

        // --- FILTRAGE ICI ---
        if (modelOnly) {
            finalResults = finalResults.filter(r => r.Type !== 'family');
        }

        setResults(finalResults);
      } else {
        console.error(error);
        setResults([]);
      }
      
      setLoading(false);
    }

    fetchResults();
  }, [debouncedQuery, modelOnly, history.length]);

  const handleSelect = (res: SearchResult) => {
    addToHistory(res);
    setIsOpen(false);
    inputRef.current?.blur();

    if (onSelect) {
      // Mode "Sélecteur" (pour le Duel)
      onSelect(res);
      setQuery(""); // On vide le champ visuel
    } else {
      // Mode "Navigation" (Comportement classique)
      const targetMarque = res.CanonicalMarque || res.Marque;
      const targetFamille = res.CanonicalFamille || res.Famille;
      const targetModele = res.CanonicalModele || res.Modele;

      if (res.Type === 'family') {
        router.push(`/${toSlug(targetMarque)}/${toSlug(targetFamille)}`);
      } else {
        if (res.MaxMY && targetModele) {
          router.push(`/${toSlug(targetMarque)}/${toSlug(targetFamille)}/${res.MaxMY}/${toSlug(targetModele)}`);
        } else {
          router.push(`/${toSlug(targetMarque)}/${toSlug(targetFamille)}`);
        }
      }
    }
  };


  const handleClear = () => {
    setQuery("");
    setResults([]); // On vide aussi les résultats
    setIsOpen(false); // On ferme le menu
    inputRef.current?.focus(); // On remet le focus dans le champ pour retaper direct
  };  
  const visibleHistory = history.filter(h => !modelOnly || h.Type !== 'family');
  // --- RENDU ---

  return (
    <div ref={wrapperRef} className={cn("relative group w-full", className)}>
      
      {/* INPUT */}
      {/* CONTAINER INPUT */}
      <div className={cn(
        "relative flex items-center transition-all duration-300",
        "focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2",        
        isHero ? "focus-within:ring-offset-slate-900" : "focus-within:ring-offset-white",

        isHero 
          ? "bg-white rounded-full p-2 shadow-2xl hover:scale-[1.01]" 
          : "bg-slate-100 rounded-full focus-within:bg-white" // Petit bonus : le fond devient blanc pur au focus dans le header
      )}>
        <div className={cn("text-slate-400 flex items-center justify-center", isHero ? "pl-6" : "pl-3")}>
          {loading ? <Loader2 className="animate-spin" size={isHero ? 24 : 14} /> : <Search size={isHero ? 24 : 14} />}
        </div>

        <input 
          ref={inputRef}
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholderText} 
          className={cn(
            "w-full bg-transparent border-none text-slate-900 font-medium focus:ring-0 focus:outline-none placeholder-slate-400",
            isHero ? "text-lg px-4 py-3 pr-12 sm:pr-8" : "text-sm px-3 py-1.5 pr-10"
          )}
        />

        {/* NOUVELLE CROIX */}
        {query.length > 0 && (
          <button
            onClick={handleClear}
            className={cn(
              "absolute text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200/50",
              isHero ? "right-4 sm:right-40" : "right-2"
            )}
          >
            <X size={16} />
          </button>
        )}
        
        {isHero && <button className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider text-sm hover:bg-blue-600 transition shadow-lg shrink-0 hidden sm:block">Chercher</button>}
      </div>

      {/* DROPDOWN */}
      {((results.length > 0 && isOpen) || (query.length === 0 && history.length > 0 && isOpen) || (!loading && query.length >= 2 && results.length === 0 && isOpen)) && (
        <div className={cn(
          "absolute bg-white border border-slate-200 shadow-xl overflow-hidden z-50 mt-2 text-left",
          isHero
            ? "left-0 w-full top-full rounded-2xl" 
            : "right-0 w-[300px] sm:w-[380px] top-full rounded-xl" 
        )}>
          <div className="py-2">
            
            {/* RÉSULTATS */}
            {results.length > 0 && isOpen && (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1 flex justify-between">
                  <span>Résultats</span>
                  <span className="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 border border-slate-200">ESC pour fermer</span>
                </div>
                {results.map((res, idx) => (
                  <ResultItem 
                    key={`${idx}`} 
                    res={res} 
                    isActive={idx === selectedIndex} 
                    onClick={() => handleSelect(res)} 
                  />
                ))}
              </>
            )}

            {/* HISTORIQUE */}
            {query.length === 0 && visibleHistory.length > 0 && isOpen && (
              <>
                 <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1 flex items-center gap-2">
                  <History size={12} />
                  <span>Dernières recherches</span>
                </div>
                {/* On map sur visibleHistory */}
                {visibleHistory.map((res, idx) => (
                  <ResultItem 
                    key={`hist-${idx}`} 
                    res={res} 
                    isActive={idx === selectedIndex} 
                    isHistory={true}
                    onClick={() => handleSelect(res)} 
                  />
                ))}
              </>
            )}

            {/* EMPTY STATE */}
            {!loading && query.length >= 2 && results.length === 0 && isOpen && (
               <div className="px-6 py-8 text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3">
                    <Search size={24} />
                  </div>
                  <p className="text-slate-900 font-bold mb-1">Aucun modèle trouvé</p>
                  <p className="text-slate-500 text-xs mb-4">Nous n{"'"}avons pas trouvé de résultat pour {"\""}{query}{"\""}.</p>
                  <Link
                    href="/marques"
                    onClick={() => {
                      setIsOpen(false);
                      setQuery("");
                      setResults([]);
                      inputRef.current?.blur();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase hover:bg-slate-200 transition"
                  >
                    <LayoutGrid size={14} />
                    Voir toutes les marques
                  </Link>
               </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
