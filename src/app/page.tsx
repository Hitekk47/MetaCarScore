import Header from "@/components/Header";
import RecentScoresCarousel from "@/components/bento/RecentScoresCarousel";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import { Database, Layers, Swords, Activity } from "lucide-react";
import LatestReviewsSection from "@/components/sections/LatestReviewsSection";
import SearchBar from "@/components/ui/SearchBar";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import HeroWord from "@/components/ui/HeroWord";

// --- OPTIMISATION 1 : CACHE (1h) ---
export const revalidate = 3600; 

// Helper moyenne
const average = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

export default async function Home() {
  
  // --- OPTIMISATION 2 : REQUÊTES ---
  const [recentReq, statsReq] = await Promise.all([
    supabase.from('reviews').select('*').order('Test_date', { ascending: false }).limit(1500),
    supabase.rpc('get_homepage_stats')
  ]);

  const reviews = (recentReq.data || []) as Review[];
  const stats = statsReq.data as { total_reviews: number, unique_models: number } | null;
  const totalEssais = stats?.total_reviews || 20000;
  const totalModeles = stats?.unique_models || 1200;

  // --- LOGIQUE MÉTIER (Groupement) ---
  const modelGroups: Record<string, { 
    Marque: string; Famille: string; Modele: string; MY: number; 
    Scores: number[]; Powers: number[]; Dates: string[] 
  }> = {};

  reviews.forEach(r => {
    const key = `${r.Marque}|${r.MY}|${r.Modele}`;
    if (!modelGroups[key]) {
      modelGroups[key] = {
        Marque: r.Marque, Famille: r.Famille, Modele: r.Modele, MY: r.MY,
        Scores: [], Powers: [], Dates: []
      };
    }
    modelGroups[key].Scores.push(r.Score);
    modelGroups[key].Powers.push(r.Puissance);
    modelGroups[key].Dates.push(r.Test_date);
  });
  
  const metaScores = Object.values(modelGroups)
    .map(group => {
      const sortedDatesAsc = group.Dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      return {
        Marque: group.Marque, Famille: group.Famille, Modele: group.Modele, MY: group.MY,
        AvgScore: average(group.Scores), ReviewCount: group.Scores.length,
        FirstTestDate: sortedDatesAsc[0], MinPower: Math.min(...group.Powers), MaxPower: Math.max(...group.Powers)
      };
    })
    .filter(item => item.ReviewCount >= 3)
    .sort((a, b) => new Date(b.FirstTestDate).getTime() - new Date(a.FirstTestDate).getTime())
    .slice(0, 15);

  const latestAdditions = reviews.slice(0, 10);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main>
        {/* === HERO === */}
        {/* 1. RETRAIT DE 'overflow-hidden' SUR LA SECTION PRINCIPALE */}
        {/* On garde z-40 pour qu'elle soit au dessus du reste de la page */}
        <section className="bg-slate-900 text-white py-20 px-4 relative z-40">
          
          {/* 2. LE BACKGROUND GÈRE LE DÉBORDEMENT (Blob) */}
          {/* C'est lui qui doit avoir overflow-hidden pour couper le halo lumineux */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]"></div>
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10 space-y-8">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">
              Trouver le véhicule <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                parfait.
              </span>
            </h1>
            
            {/* 3. CONTAINER DE RECHERCHE : Z-INDEX MAXIMAL */}
            <div className="relative max-w-2xl mx-auto z-50">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-20 animate-pulse pointer-events-none"></div>
              
              {/* Le composant SearchBar a déjà son propre z-index pour le dropdown, 
                  mais le parent z-50 ici assure qu'il gagne sur le texte "Toute la presse..." en dessous */}
              <SearchBar 
                variant="hero" 
                placeholder="Trouvez le score de n'importe quel véhicule..." 
              />
            </div>
            
            {/* Ce texte a un z-index implicite (auto), donc z-50 passera au dessus */}
            <p className="text-slate-400 font-medium text-sm mt-4 relative z-10">
              Toute la presse auto synthétisée en un score unique.
            </p>
          </div>
        </section>

        {/* === CARROUSEL === */}
    <section className="max-w-7xl mx-auto px-4 py-12 border-b border-slate-200">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
          
          <span>Derniers MetaCarScores</span>
              <div className="flex items-center gap-2 md:pl-3 md:border-l border-slate-300 md:ml-2 shrink-0">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                
                {/* J'ai retiré le <br> pour garder sur une ligne propre en dessous du titre */}
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none whitespace-nowrap">
                    Flux temps réel
                </span>
              </div>

            </h2>
          </div>
          <RecentScoresCarousel items={metaScores} />
        </section>

        {/* === STATS & NAV === */}
        <section className="bg-white border-y border-slate-200 py-12">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* STAT 1: ESSAIS (ANIMÉ) */}
            <div className="flex flex-col justify-center border-l-4 border-slate-100 pl-6 group hover:border-blue-500 transition-colors duration-500">
              <div className="flex items-center gap-2 text-slate-400 mb-1 group-hover:text-blue-500 transition-colors">
                <Database size={16} />
                <span className="text-xs font-bold uppercase">Depuis 2019</span>
              </div>
              <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                 {/* Utilisation du composant client */}
                 <AnimatedCounter value={totalEssais} />
              </div>
              <div className="text-sm font-medium text-slate-500">Essais référencés</div>
            </div>

            {/* STAT 2: CATALOGUE (ANIMÉ) */}
            <div className="flex flex-col justify-center border-l-4 border-slate-100 pl-6 group hover:border-emerald-500 transition-colors duration-500">
              <div className="flex items-center gap-2 text-slate-400 mb-1 group-hover:text-emerald-500 transition-colors">
                <Layers size={16} />
                <span className="text-xs font-bold uppercase">Catalogue</span>
              </div>
              <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                 <AnimatedCounter value={totalModeles} />
              </div>
              <div className="text-sm font-medium text-slate-500">Modèles uniques</div>
            </div>

            {/* LIEN TOPS */}
            <a href="/tops" className="group bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl p-6 transition-all cursor-pointer border border-slate-100 hover:shadow-xl hover:-translate-y-1">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-lg">Top Classements</span>
                <Activity className="text-slate-300 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-500 group-hover:text-slate-400">Les meilleurs par catégorie.</p>
            </a>

            {/* LIEN DUELS */}
            <a href="/duels" className="group bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl p-6 transition-all cursor-pointer border border-slate-100 hover:shadow-xl hover:-translate-y-1">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-lg">Mode Duel</span>
                <Swords className="text-slate-300 group-hover:text-white" />
              </div>
              <p className="text-xs text-slate-500 group-hover:text-blue-100">Affrontez deux modèles.</p>
            </a>
          </div>
        </section>

        {/* === DERNIERS AJOUTS === */}
        <LatestReviewsSection initialData={latestAdditions} />
      </main>
    </div>
  );
}