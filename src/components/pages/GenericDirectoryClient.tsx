"use client";

import { useState, useRef } from "react";
import Header from "@/components/Header";
import { PAGE_CONTAINER } from "@/lib/layout";
import DirectorySortButton from "./DirectorySortButton";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Search, X, Columns3, LayoutGrid } from "lucide-react";
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
  const [sortOtherAlpha, setSortOtherAlpha] = useState(false);
  const [view, setView] = useState<"simple" | "segments">(segmented ? "segments" : "simple");
  const inputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();
  const showSegments = segmented && view === "segments";
  const lowerQuery = query.toLowerCase();
  const filteredItems = items.filter(item => item.title.toLowerCase().includes(lowerQuery));
  const displayItems = sortAlpha
    ? [...filteredItems].sort((a, b) => a.title.localeCompare(b.title, "fr"))
    : filteredItems;
  const segmentedItems = filteredItems.filter(item => item.segments?.length);
  const otherItems = filteredItems.filter(item => !item.segments?.length);
  const displayOtherItems = sortOtherAlpha
    ? [...otherItems].sort((a, b) => a.title.localeCompare(b.title, "fr"))
    : otherItems;
  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans pb-20">
      <Header />
      <main className={cn(PAGE_CONTAINER, "py-8 sm:py-12")}>
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
              <div className="relative flex min-w-0 flex-1 items-center rounded-full border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2 lg:w-80">
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 text-slate-400" />
                <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholderSearch} aria-label={placeholderSearch} className="w-full rounded-full border-none bg-transparent py-3 pl-11 pr-12 text-sm font-bold outline-none placeholder-slate-400" />
                {query.length > 0 && (
                  <button type="button" onClick={handleClear} aria-label="Effacer la recherche" className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-blue-600"><X size={16} aria-hidden="true" /></button>
                )}
              </div>
              {!showSegments && <DirectorySortButton active={sortAlpha} onClick={() => setSortAlpha(!sortAlpha)} />}
            </div>
          </div>
        </div>
        {displayItems.length === 0 ? (
          <div role="status" className="py-20 text-center text-slate-500">Aucun résultat pour {"\""}{query}{"\""}</div>
        ) : showSegments ? (
          <>
            {segmentedItems.length > 0 && <BrandSegmentColumns items={segmentedItems} />}
            {otherItems.length > 0 && (
              <section aria-label="Gammes sans segmentation" className={cn(segmentedItems.length > 0 && "mt-10 border-t border-slate-200 pt-8")}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Autres gammes</h2>
                    <p className="mt-1 text-sm text-slate-500">{otherItems.length} gamme{otherItems.length > 1 ? "s" : ""} · Modèles anciens ou sans segmentation disponible</p>
                  </div>
                  <DirectorySortButton active={sortOtherAlpha} onClick={() => setSortOtherAlpha(!sortOtherAlpha)} />
                </div>
                <DirectoryGrid items={displayOtherItems} reducedMotion={!!reducedMotion} />
              </section>
            )}
          </>
        ) : (
          <DirectoryGrid items={displayItems} reducedMotion={!!reducedMotion} />
        )}
      </main>
    </div>
  );
}

function DirectoryGrid({ items, reducedMotion }: { items: DirectoryItem[]; reducedMotion: boolean }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <motion.div key={item.id} layout={!reducedMotion} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}><DirectoryCard item={item} /></motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
