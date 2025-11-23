import Header from "@/components/Header";
import ReviewsTableCompact from "@/components/tables/ReviewsTableCompact";
import ScoreBadge from "@/components/ui/ScoreBadge";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";

// Cette fonction rend le composant asynchrone pour fetcher les données sur le serveur
export default async function Home() {
  
  // 1. REQUÊTE SUPABASE : Récupérer les 30 derniers essais
  const { data: recentReviews, error } = await supabase
    .from('reviews')
    .select('*')
    .order('Test_date', { ascending: false }) // Du plus récent au plus vieux
    .limit(30);

  if (error) {
    console.error("Erreur Supabase:", error);
  }

  // On caste les données pour être sûr qu'elles correspondent à notre type Review
  const reviews = (recentReviews || []) as Review[];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        
        {/* SECTION HERO : BENTO GRID (Statique pour l'instant, mais jolie) */}
        <section>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">À la une</h2>
            <span className="text-xs font-bold text-slate-400 uppercase">Sélection de la rédaction</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-auto md:h-[400px]">
            
            {/* GRANDE CARTE (Vedette) */}
            <div className="md:col-span-2 md:row-span-2 bg-slate-900 text-white rounded-2xl p-8 relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-300 min-h-[300px]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-20 group-hover:opacity-30 transition"></div>
              
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Tendance
                  </div>
                  <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.9]">
                    XPENG <br/> <span className="text-emerald-400">G9</span>
                  </h3>
                  <p className="mt-2 text-slate-400 font-medium">Performance Edition</p>
                </div>

                <div className="flex items-end justify-between mt-8 md:mt-0">
                  <div>
                    <span className="block text-xs uppercase text-slate-500 font-bold mb-1">Moyenne</span>
                    <ScoreBadge score={88} size="xl" />
                  </div>
                  <div className="text-right hidden sm:block">
                     <div className="text-3xl font-mono font-bold">650<span className="text-sm">ch</span></div>
                     <div className="text-sm text-slate-400 uppercase">Électrique</div>
                  </div>
                </div>
              </div>
            </div>

            {/* PETITE CARTE 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-400 transition cursor-pointer min-h-[180px]">
              <div className="flex justify-between items-start">
                 <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Nouveauté</div>
                    <div className="font-black text-xl uppercase leading-none mt-1">Toyota <br/> Aygo X</div>
                 </div>
                 <ScoreBadge score={80} size="md" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs font-bold text-slate-500">
                 <span>116 ch</span>
                 <span>Hybride</span>
              </div>
            </div>

            {/* PETITE CARTE 2 (STATISTIQUES) */}
            <div className="bg-blue-600 text-white rounded-2xl p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-blue-700 transition min-h-[180px]">
               <div className="text-sm font-bold uppercase opacity-80 mb-2">Base de données</div>
               <div className="text-5xl font-black tracking-tighter mb-1">20k+</div>
               <div className="text-xs font-medium opacity-60">Essais référencés</div>
            </div>

            {/* PETITE CARTE 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-400 transition cursor-pointer min-h-[180px]">
              <div className="flex justify-between items-start">
                 <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Familiale</div>
                    <div className="font-black text-xl uppercase leading-none mt-1">VW <br/> ID.Buzz</div>
                 </div>
                 <ScoreBadge score={80} size="md" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs font-bold text-slate-500">
                 <span>340 ch</span>
                 <span>LWB</span>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION TABLEAU : VRAIES DONNÉES */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Derniers ajouts</h2>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">Mis à jour en temps réel</span>
          </div>
          
          {/* Le tableau reçoit les données Supabase */}
          <ReviewsTableCompact data={reviews} />
          
          <div className="mt-4 text-center">
            <button className="px-6 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-sm uppercase rounded shadow-sm hover:bg-slate-50 transition">
              Voir tous les essais
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}