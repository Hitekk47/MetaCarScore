"use client";
import Link from 'next/link'; // <--- L'IMPORT QUI MANQUAIT
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import SearchBar from "./ui/SearchBar";

const NAV_ITEMS = [
  { label: 'Marques', href: '/marques' },
  { label: 'Classements', href: '/tops' },
  { label: 'Top 100', href: '/tops/modeles' },
  // { label: 'Comparateur', href: '/duels' },
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
        
        {/* 1. LOGO (Gauche) */}
        {/* pointer-events-none sur le container pour laisser passer les clics en dessous */}
        <div className="flex-1 flex justify-start z-10 pointer-events-none">
            {/* pointer-events-auto sur le lien pour qu'il reste cliquable */}
            <Link href="/" className="flex items-center gap-2 group pointer-events-auto">
            <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-black text-lg tracking-tighter group-hover:bg-brand-primary transition-colors">
                M
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:inline-block">
                METACAR<span className="text-brand-primary">SCORE</span>
            </span>
            </Link>
        </div>

        {/* 2. NAVIGATION (Centre Absolu) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href) && item.href !== '/';
            
            return (
                <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                    "text-xs font-bold uppercase tracking-wide transition-colors relative py-2",
                    isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
                >
                {item.label}
                {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-primary"></span>
                )}
                </Link>
            );
          })}
        </div>

        {/* 3. SEARCH BAR (Droite) */}
        <div className="flex-1 flex justify-end z-10 pointer-events-none">
            <div className={cn(
            "relative transition-all duration-500 ease-in-out transform origin-right flex items-center pointer-events-auto",
            showSearch 
                ? "opacity-100 scale-100 translate-x-0 w-auto" 
                : "opacity-0 scale-95 translate-x-4 w-0 pointer-events-none"
            )}>
                <div className="w-64">
                    <SearchBar variant="header" placeholder="Rechercher..." />
                </div>
            </div>
        </div>

      </div>
    </header>
  );
}