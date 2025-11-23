"use client";
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Top Marques', href: '/tops/marques' },
  { label: 'Top Électriques', href: '/tops/electrique' },
  { label: 'Top Hybrides', href: '/tops/hybride' },
  { label: 'Top Breaks', href: '/tops/breaks' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* LOGO TYPOGRAPHIQUE */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-black text-lg tracking-tighter group-hover:bg-blue-600 transition-colors">
            M
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">
            METACAR<span className="text-blue-600">SCORE</span>
          </span>
        </Link>

        {/* NAVIGATION DESKTOP */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wide"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* SEARCH BAR COMPACTE */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Rechercher (ex: Megane...)" 
            className="pl-8 pr-4 py-1.5 bg-slate-100 border-none rounded text-sm w-48 focus:w-64 transition-all focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
        </div>
      </div>
    </header>
  );
}