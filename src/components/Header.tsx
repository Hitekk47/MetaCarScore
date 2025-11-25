"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import SearchBar from "./ui/SearchBar";

const NAV_ITEMS = [
  { label: 'Top Marques', href: '/tops/marques' },
  { label: 'Top Électriques', href: '/tops/electrique' },
  { label: 'Top Hybrides', href: '/tops/hybride' },
  { label: 'Top Breaks', href: '/tops/breaks' },
];

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showSearch = !isHomePage || isScrolled;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center relative">
        
        {/* 1. LOGO (Aligné à gauche - Flex Grow pour pousser) */}
        {/* z-10 pour passer au dessus du menu si l'écran est petit */}
        <div className="flex-1 flex justify-start z-10">
            <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-black text-lg tracking-tighter group-hover:bg-brand-primary transition-colors">
                M
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:inline-block">
                METACAR<span className="text-brand-primary">SCORE</span>
            </span>
            </Link>
        </div>

        {/* 2. NAVIGATION (Centre Absolu) */}
        {/* La position absolute empêche le menu de bouger quand la recherche apparait/disparait */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wide whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* 3. SEARCH BAR (Aligné à droite - Flex Grow) */}
        <div className="flex-1 flex justify-end z-10">
            <div className={cn(
            "relative transition-all duration-500 ease-in-out transform origin-right flex items-center",
            showSearch 
                ? "opacity-100 scale-100 translate-x-0 w-auto pointer-events-auto" 
                : "opacity-0 scale-95 translate-x-4 w-0 pointer-events-none"
            )}>
                {/* On force une largeur fixe au conteneur interne pour éviter le reflow du contenu */}
                <div className="w-64">
                    <SearchBar variant="header" placeholder="Rechercher..." />
                </div>
            </div>
        </div>

      </div>
    </header>
  );
}