"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Menu, X, HelpCircle } from 'lucide-react';
import SearchBar from "./ui/SearchBar";
import { AnimatePresence, motion } from 'framer-motion';

const NAV_ITEMS = [
  { label: 'Marques', href: '/marques' },
  { label: 'Classements', href: '/tops' },
  { label: 'Top 100', href: '/tops/modeles' },
  { label: 'Duel', href: '/duels' },
];

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [isMobileMenuOpen]);

  const showSearch = !isHomePage || isScrolled;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">
          
          {/* LOGO */}
          <div className="flex shrink-0 items-center z-20 pointer-events-none">
              <Link href="/" className="flex items-center gap-2 group pointer-events-auto">
                <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-black text-lg tracking-tighter group-hover:bg-blue-600 transition-colors shadow-sm">
                    M
                </div>
                <span className={cn(
                    "font-bold text-lg tracking-tight text-slate-900 transition-opacity duration-300",
                    showSearch ? "hidden sm:inline-block" : "inline-block"
                )}>
                    METACAR<span className="text-blue-600">SCORE</span>
                </span>
              </Link>
          </div>

          {/* NAVIGATION DESKTOP (Centre) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex items-center gap-6 xl:gap-8 z-30">
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
                  {isActive && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600"></span>}
                  </Link>
              );
            })}
          </div>

          {/* DROITE (Search + Burger) */}
          <div className="flex items-center justify-end gap-2 z-20 flex-1 pointer-events-none">
              <div className={cn(
                "transition-all duration-500 ease-in-out transform origin-right flex items-center pointer-events-auto",
                showSearch 
                    ? "opacity-100 scale-100 w-[180px] sm:w-64"
                    : "opacity-0 scale-95 w-0 overflow-hidden"
              )}>
                  <SearchBar variant="header" placeholder="Chercher..." />
              </div>
              <Link 
                  href="/about"
                  className="hidden lg:flex w-9 h-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all pointer-events-auto ml-2"
                  title="Méthodologie"
              >
                  <HelpCircle size={18} />
              </Link>

              {/* BOUTON MENU MOBILE */}
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-900 hover:bg-slate-100 rounded-full transition-colors pointer-events-auto"
              >
                <Menu size={24} />
              </button>
          </div>
        </div>
      </header>

      {/* OVERLAY MENU MOBILE */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-white flex flex-col"
          >
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
               <span className="font-bold text-lg tracking-tight text-slate-900">MENU</span>
               <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-8 px-6 flex flex-col gap-6">
               {NAV_ITEMS.map((item) => (
                 <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black uppercase tracking-tight text-slate-900 border-b border-slate-100 pb-4 flex justify-between items-center group active:text-blue-600 transition-colors">
                    {item.label}
                 </Link>
               ))}
               <div className="mt-8">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-4">Recherche rapide</p>
                  <SearchBar variant="header" placeholder="Une marque, un modèle..." />
               </div>
                  <Link 
                        href="/about" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 text-sm font-bold uppercase tracking-wide text-slate-400 border-t border-slate-100 pt-6 mt-2"
                  >
                        <HelpCircle size={18} />
                        <span>Notre Méthodologie</span>
                  </Link>
            </div>
            <div className="p-6 bg-slate-50 text-center text-xs text-slate-400">© {new Date().getFullYear()} MetaCarScore. No Images. Pure Data.</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}