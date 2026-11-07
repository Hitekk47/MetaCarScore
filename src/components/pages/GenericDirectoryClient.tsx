"use client";

import { useState, useRef } from "react";
import Header from "@/components/Header";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Search, X, ArrowDownAZ, Columns3, LayoutGrid } from "lucide-react";
import DirectoryCard from "./DirectoryCard";
import BrandSegmentColumns from "./BrandSegmentColumns";
import type { DirectoryItem } from "./directory-types";

export type { DirectoryItem } from "./directory-types";

type Props = {
  title: string;
  subtitle: string;
  items: DirectoryItem[];
  placeholderSearch: string;
  segmented?: boolean;
};

export default function GenericDirectoryClient({ title, subtitle, items, placeholderSearch, segmented = false }: Props) {
  const [query, setQuery] = useState("");
  const [sortAlpha, setSortAlpha] = useState(false);
  const [view, setView] = useState<"simple" | "segments">(segmented ? "segments" : "simple");
  const inputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();
  const showSegments = segmented && view === "segments";
  const lowerQuery = query.toLowerCase();
  const filteredItems = items.filter(item => item.title.toLowerCase().includes(lowerQuery));
  const displayItems = sortAlpha
    ? [...filteredItems].sort((a, b) => a.title.localeCompare(b.title, "fr"))
    : filteredItems;
  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans pb-20">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8 border-b border-slate-200 pb-8">
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-2 uppercase break-words">{title}</h1>
          <p className="text-slate-500 font-medium max-w-xl">{subtitle}</p>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {segmented && (
              <div role="group" aria-label="Affichage de la gamme" className="flex self-start rounded-full border border-slate-200 bg-slate-100 p-1">
                {([
                  { value: "simple", label: "Simple", icon: LayoutGrid },
                  { value: "segments", label: "Par segment", icon: Columns3 },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn("flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors focus-visible:outline-blue-600", view === value ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900")}>
                    <Icon size={16} aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
            )}
            <div className={cn("flex w-full min-w-0 flex-wrap items-center gap-3", segmented ? "lg:w-auto" : "lg:max-w-xl")}>
              <div className={cn("relative flex min-w-0 flex-1 items-center rounded-full border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2 lg:w-80", segmented && "basis-full sm:basis-auto")}>
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 text-slate-400" />
                <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholderSearch} aria-label={placeholderSearch} className="w-full rounded-full border-none bg-transparent py-3 pl-11 pr-12 text-sm font-bold outline-none placeholder-slate-400" />
                {query.length > 0 && (
                  <button type="button" onClick={handleClear} aria-label="Effacer la recherche" className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-blue-600"><X size={16} aria-hidden="true" /></button>
                )}
              </div>
              {!showSegments && (
                segmented ? (
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    Trier par
                    <select value={sortAlpha ? "alpha" : "reviews"} onChange={e => setSortAlpha(e.target.value === "alpha")} className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 focus-visible:outline-blue-600">
                      <option value="reviews">Nombre d’essais</option>
                      <option value="alpha">Ordre alphabétique</option>
                    </select>
                  </label>
                ) : (
                  <button type="button" aria-pressed={sortAlpha} onClick={() => setSortAlpha(!sortAlpha)} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm focus-visible:outline-blue-600", sortAlpha ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:text-slate-900")} title={sortAlpha ? "Tri par défaut" : "Trier par ordre alphabétique"}><ArrowDownAZ size={20} aria-hidden="true" /></button>
                )
              )}
            </div>
          </div>
        </div>
        {displayItems.length === 0 ? (
          <div role="status" className="py-20 text-center text-slate-500">Aucun résultat pour {"\""}{query}{"\""}</div>
        ) : showSegments ? (
          <BrandSegmentColumns items={filteredItems} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {displayItems.map(item => (
                <motion.div key={item.id} layout={!reducedMotion} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}><DirectoryCard item={item} /></motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
