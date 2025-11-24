import Header from "@/components/Header";
import ReviewsTableCompact from "@/components/tables/ReviewsTableCompact";
import RecentScoresCarousel from "@/components/bento/RecentScoresCarousel";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
import { Search, Database, Layers, Swords } from "lucide-react";
import LatestReviewsSection from "@/components/sections/LatestReviewsSection";
import SearchBar from "@/components/ui/SearchBar";

// --- OPTIMISATION 1 : CACHE ---
// La page est générée sur le serveur et mise en cache pour 1 heure (3600s).
// Le prochain visiteur recevra la version HTML instantanément sans toucher à la BDD.
export const revalidate = 3600; 

// Helper moyenne
const average = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

export default async function Home() {
  
  // --- OPTIMISATION 2 : REQUÊTES LÉGÈRES ---
  const [recentReq, statsReq] = await Promise.all([
    // 1. On récupère juste ce qu'il faut pour le carrousel (1500 suffisent largement)
    supabase
      .from('reviews')
      .select('*')
      .order('Test_date', { ascending: false })
      .limit(1500),

    // 2. APPEL RPC : On exécute la fonction SQL créée dans Supabase.
    // Coût bande passante : ~50 octets (vs ~5 Mo avant !)
    supabase.rpc('get_homepage_stats')
  ]);

  const reviews = (recentReq.data || []) as Review[];
  
  // Récupération des stats depuis le RPC (avec valeurs par défaut au cas où)
  const stats = statsReq.data as { total_reviews: number, unique_models: number } | null;
  const totalEssais = stats?.total_reviews || 20000;
  const totalModeles = stats?.unique_models || 1200;


  // --- LOGIQUE MÉTIER (Inchangée) ---
  const modelGroups: Record<string, { 
    Marque: string; 
    Famille: string; 
    Modele: string; 
    MY: number; 
    Scores: number[]; 
    Powers: number[]; 
    Dates: string[] 
  }> = {};

  reviews.forEach(r => {
    const key = `${r.Marque}|${r.MY}|${r.Modele}`;
    if (!modelGroups[key]) {
      modelGroups[key] = {
        Marque: r.Marque,
        Famille: r.Famille,
        Modele: r.Modele,
        MY: r.MY,
        Scores: [],
        Powers: [],
        Dates: []
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
        Marque: group.Marque,
        Famille: group.Famille,
        Modele: group.Modele,
        MY: group.MY,
        AvgScore: average(group.Scores),
        ReviewCount: group.Scores.length,
        FirstTestDate: sortedDatesAsc[0],
        MinPower: Math.min(...group.Powers),
        MaxPower: Math.max(...group.Powers)
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
{/* === HERO SEARCH === */}
        {/* Note : On retire overflow-hidden d'ici pour laisser passer le menu */}
        <section className="bg-slate-900 text-white py-20 px-4 relative z-40">
          
          {/* BACKGROUND CONTAINER : C'est lui qui gère le débordement des blobs */}
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
            
            {/* SEARCH BAR CONTAINER */}
            <div className="relative max-w-2xl mx-auto z-50">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-20 animate-pulse pointer-events-none"></div>
              {/* Le z-50 ici assure qu'il passe au dessus de tout */}
              <SearchBar 
                variant="hero" 
                placeholder="Quelle voiture cherchez-vous ? (ex: Renault Megane...)" 
              />
            </div>
            
            <p className="text-slate-400 font-medium text-sm mt-4">
              Recherchez parmi plus de 20 000 essais agrégés.
            </p>
          </div>
        </section>

        {/* CARROUSEL */}
        <section className="max-w-7xl mx-auto px-4 py-12 border-b border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
              Derniers MetaCarScores
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] rounded font-bold uppercase tracking-wide">Tendances</span>
            </h2>
          </div>
          <RecentScoresCarousel items={metaScores} />
        </section>

        {/* STATS & NAV (Optimisé) */}
        <section className="bg-white border-y border-slate-200 py-12">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col justify-center border-l-4 border-slate-100 pl-6">
              <div className="flex items-center gap-2 text-slate-400 mb-1"><Database size={16} /><span className="text-xs font-bold uppercase">Depuis 2019</span></div>
              <div className="text-4xl font-black text-slate-900 tracking-tighter">{totalEssais.toLocaleString('fr-FR')}</div>
              <div className="text-sm font-medium text-slate-500">Essais référencés</div>
            </div>
            <div className="flex flex-col justify-center border-l-4 border-slate-100 pl-6">
              <div className="flex items-center gap-2 text-slate-400 mb-1"><Layers size={16} /><span className="text-xs font-bold uppercase">Catalogue</span></div>
              <div className="text-4xl font-black text-slate-900 tracking-tighter">{totalModeles.toLocaleString('fr-FR')}</div>
              <div className="text-sm font-medium text-slate-500">Modèles uniques</div>
            </div>
            <a href="/tops" className="group bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl p-6 transition-all cursor-pointer border border-slate-100">
              <div className="flex justify-between items-start mb-2"><span className="font-bold text-lg">Top Classements</span><Layers className="text-slate-300 group-hover:text-white" /></div>
              <p className="text-xs text-slate-500 group-hover:text-slate-400">Les meilleurs par catégorie.</p>
            </a>
            <a href="/duels" className="group bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl p-6 transition-all cursor-pointer border border-slate-100">
              <div className="flex justify-between items-start mb-2"><span className="font-bold text-lg">Comparateur</span><Swords className="text-slate-300 group-hover:text-white" /></div>
              <p className="text-xs text-slate-500 group-hover:text-blue-100">Duel de fiches techniques.</p>
            </a>
          </div>
        </section>

        {/* TABLEAU */}
{/* === SECTION DYNAMIQUE : TABLEAU DERNIERS AJOUTS === */}
        {/* On passe les 10 premières données chargées par le serveur comme état initial */}
        <LatestReviewsSection initialData={latestAdditions} />

      </main>
    </div>
  );
}