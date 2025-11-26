"use client";

import { useState, useRef } from "react";
import Header from "@/components/Header";
import { motion, AnimatePresence } from "framer-motion"; // Ajout AnimatePresence
import { cn } from "@/lib/utils";
import { Search, ChevronRight, X, Trophy, Zap, Leaf, Fuel, Cog, LayoutGrid, Layers, LucideIcon } from "lucide-react";
import Link from "next/link";

// MAPPING ICONES
const ICON_MAP: Record<string, LucideIcon> = {
  trophy: Trophy,
  zap: Zap,
  leaf: Leaf,
  fuel: Fuel,
  cog: Cog,
  grid: LayoutGrid,
  layers: Layers
};

export type DirectoryItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  iconName?: keyof typeof ICON_MAP;
  letter?: string;
  colorClass?: string;
};

type Props = {
  title: string;
  subtitle: string;
  items: DirectoryItem[];
  placeholderSearch: string;
};

export default function GenericDirectoryClient({ title, subtitle, items, placeholderSearch }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-12">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 border-b border-slate-200 pb-8">
            <div>
                <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-2 uppercase">{title}</h1>
                <p className="text-slate-500 font-medium max-w-xl">{subtitle}</p>
            </div>

            {/* BARRE DE RECHERCHE (Avec Croix et Focus) */}
            <div className={cn(
                "relative flex items-center group w-full md:w-80 transition-all duration-300",
                "bg-white border border-slate-200 rounded-full shadow-sm",
                "focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2 focus-within:border-transparent"
            )}>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search size={18} className="text-slate-400 group-focus-within:text-slate-900 transition" />
                </div>
                
                <input 
                    ref={inputRef}
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholderSearch}
                    className="pl-11 pr-10 py-3 w-full bg-transparent border-none rounded-full text-sm font-bold focus:ring-0 outline-none placeholder-slate-400"
                />

                {query.length > 0 && (
                    <button 
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition z-10"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>

        {/* GRILLE */}
        {/* Suppression des variants "container" qui causaient le bug */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
                {filteredItems.map((item) => {
                    const IconComponent = item.iconName ? ICON_MAP[item.iconName] : null;

                    return (
                        <motion.div 
                            key={item.id}
                            layout // Animation magique de réorganisation
                            initial={{ opacity: 0, scale: 0.9 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Link 
                                href={item.href}
                                className={cn(
                                    "group relative block h-40 rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg",
                                    item.colorClass ? item.colorClass.replace('text-', 'bg-').replace('600', '50') : "bg-white border-slate-200 hover:border-slate-400"
                                )}
                            >
                                <div className="absolute -right-4 -bottom-6 opacity-10 pointer-events-none select-none transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12">
                                    {IconComponent ? (
                                        <IconComponent size={140} />
                                    ) : (
                                        <span className="text-[160px] font-black leading-none tracking-tighter text-slate-900">
                                            {item.letter}
                                        </span>
                                    )}
                                </div>

                                <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        {IconComponent && (
                                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-3", item.colorClass?.replace('bg-', 'bg-opacity-20 '))} >
                                                <IconComponent size={20} />
                                            </div>
                                        )}
                                        {!IconComponent && <div className="h-10"></div>}
                                        
                                        <span className="w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                            <ChevronRight size={16} className="text-slate-900" />
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1 group-hover:translate-x-1 transition-transform truncate">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs font-bold opacity-60 uppercase tracking-wider">
                                            {item.subtitle}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
            <div className="text-center py-20 text-slate-400">Aucun résultat pour "{query}"</div>
        )}

      </main>
    </div>
  );
}