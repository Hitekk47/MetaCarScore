"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import SearchBar from "./ui/SearchBar";

const NAV_ITEMS = [
  { label: 'Top Marques', href: '/tops/marques' },
  { label: 'Top Électriques', href: '/tops/electrique' },
  { label: 'Top Hybrides', href: '/tops/hybride' },
  { label: 'Top Breaks', href: '/tops/breaks' },
];

export default function Header() {
  const pathname = usePathname(); // On récupère l'URL en cours
  const isHomePage = pathname === '/'; // Est-ce qu'on est à l'accueil ?
  
  const [isScrolled, setIsScrolled] = useState(false);

  // Détection du Scroll
  useEffect(() => {
    const handleScroll = () => {
      // Seuil de 400px (Hauteur du Hero)
      setIsScrolled(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // LOGIQUE FINALE D'AFFICHAGE :
  // Afficher SI (Ce n'est pas l'accueil) OU (On a scrollé sur l'accueil)
  const showSearch = !isHomePage || isScrolled;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-black text-lg tracking-tighter group-hover:bg-brand-primary transition-colors">
            M
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:inline-block">
            METACAR<span className="text-brand-primary">SCORE</span>
          </span>
        </Link>

        {/* NAV */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wide"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* SEARCH BAR (Intelligente) */}
        <div className={cn(
          "relative transition-all duration-500 ease-in-out transform origin-right flex items-center z-50", // z-50 ici aussi
          showSearch 
            ? "opacity-100 scale-100 translate-x-0 w-auto pointer-events-auto" 
            : "opacity-0 scale-95 translate-x-4 w-0 pointer-events-none"
        )}>
          <div className="w-64"> {/* On contraint la largeur */}
              <SearchBar variant="header" placeholder="Rechercher..." />
          </div>
        </div>
      </div>
    </header>
  );
}