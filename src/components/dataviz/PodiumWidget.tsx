"use client";

import Link from "next/link";
import { Review } from "@/lib/types";
import { Trophy, Gauge, Brain } from "lucide-react";
import ScoreBadge from "../ui/ScoreBadge";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type TabType = 'score' | 'power' | 'smart';

export default function PodiumWidget({ reviews }: { reviews: Review[] }) {
  const [activeTab, setActiveTab] = useState<TabType>('score');
  
  // 1. AGRÉGATION DES DONNÉES
  const rawModelsData = useMemo(() => {
    const groups: Record<string, { totalScore: number; maxPower: number; count: number; name: string; my: number }> = {};

    reviews.forEach(r => {
      const name = r.Modele;
      // Initialisation
      if (!groups[name]) groups[name] = { totalScore: 0, maxPower: 0, count: 0, name, my: r.MY };
      
      groups[name].totalScore += r.Score;
      groups[name].count += 1;
      
      // On capture le MY de la version la plus puissante/récente rencontrée pour construire le lien
      if (r.Puissance > groups[name].maxPower) {
        groups[name].maxPower = r.Puissance;
        groups[name].my = r.MY; 
      }
    });

    return Object.values(groups).map(g => ({
      name: g.name,
      avgScore: Math.round(g.totalScore / g.count),
      power: g.maxPower,
      count: g.count,
      my: g.my
    }));
  }, [reviews]);

  // 2. CALCUL DES CLASSEMENTS PAR ONGLET
  const rankings = useMemo(() => {
    
    // A. TOP SCORE (Règle : Min 3 essais)
    const byScore = rawModelsData
      .filter(m => m.count >= 3)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);

    // B. TOP PUISSANCE (Règle : AUCUNE limite d'essais)
    const byPower = rawModelsData
      .sort((a, b) => b.power - a.power)
      .slice(0, 3);

    // C. CHOIX RAISONNABLE (Règle : Min 3 essais + Puissance "médiane")
    const avgPowerOfRange = rawModelsData.reduce((acc, curr) => acc + curr.power, 0) / (rawModelsData.length || 1);
    
    const bySmart = rawModelsData
      .filter(m => m.count >= 3)
      .filter(m => m.power <= avgPowerOfRange + 50) // Marge de tolérance
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);

    return { score: byScore, power: byPower, smart: bySmart };
  }, [rawModelsData]);

  const currentList = rankings[activeTab];

  // Si aucune donnée (ex: liste vide), on n'affiche rien
  if (rawModelsData.length === 0) return null;

  // Pour construire les liens, on a besoin de la Marque et Famille (communes à tous les reviews ici)
  const baseMarque = reviews[0]?.Marque;
  const baseFamille = reviews[0]?.Famille;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      
      {/* HEADER AVEC ONGLETS */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Top 3 Modèles
        </h3>
        
        {/* TABS */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('score')}
                className={cn("p-1.5 rounded-md transition-all", activeTab === 'score' ? "bg-white text-yellow-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                title="Meilleures Notes"
            >
                <Trophy size={14} />
            </button>
            <button 
                onClick={() => setActiveTab('power')}
                className={cn("p-1.5 rounded-md transition-all", activeTab === 'power' ? "bg-white text-orange-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                title="Les plus puissantes"
            >
                <Gauge size={14} />
            </button>
            <button 
                onClick={() => setActiveTab('smart')}
                className={cn("p-1.5 rounded-md transition-all", activeTab === 'smart' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                title="Choix Raisonnable"
            >
                <Brain size={14} />
            </button>
        </div>
      </div>

      {/* LISTE ANIMÉE */}
      <div className="space-y-4 min-h-[160px]">
        {currentList.length > 0 ? (
           currentList.map((model, index) => {
              const isGold = index === 0;
              const isSilver = index === 1;

              return (
                  <motion.div 
                    key={`${activeTab}-${model.name}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {/* LIEN DE NAVIGATION */}
                    <Link 
                        href={`/${baseMarque}/${baseFamille}/${model.my}/${model.name}`}
                        className="flex items-center justify-between group cursor-pointer p-1 -mx-1 rounded hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            {/* MÉDAILLE */}
                            <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 border",
                                isGold ? "bg-yellow-50 text-yellow-600 border-yellow-100" :
                                isSilver ? "bg-slate-50 text-slate-500 border-slate-100" :
                                "bg-orange-50 text-orange-700 border-orange-100"
                            )}>
                                {index + 1}
                            </div>
                            
                            {/* NOM & INFOS */}
                            <div className="flex flex-col truncate pr-2">
                                <span className="font-bold text-slate-900 text-sm truncate uppercase leading-tight group-hover:text-blue-600 transition-colors" title={model.name}>
                                    {model.name}
                                </span>
                                
                                <span className="text-[10px] font-medium text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                                    
                                    {/* CAS PUISSANCE */}
                                    {activeTab === 'power' && (
                                      <span className="text-slate-600 font-bold">{model.power} ch</span>
                                    )}

                                    {/* CAS NOTES (Avec MY) */}
                                    {activeTab === 'score' && (
                                      <>
                                          <span className="bg-slate-100 px-1 rounded text-slate-500 font-bold">MY {model.my}</span>
                                          <span>• {model.count} essais</span>
                                      </>
                                    )}

                                    {/* CAS SMART (Avec MY) */}
                                    {activeTab === 'smart' && (
                                      <>
                                          <span className="bg-slate-100 px-1 rounded text-slate-500 font-bold">MY {model.my}</span>
                                          <span className="text-blue-500 font-medium">• Choix malin</span>
                                      </>
                                    )}

                                </span>
                            </div>
                        </div>

                        {/* SCORE BADGE */}
                        <div className="transform scale-75 origin-right shrink-0">
                            <ScoreBadge 
                              score={model.avgScore} 
                              size="sm" 
                              reviewCount={model.count} 
                            />
                        </div>
                    </Link>
                  </motion.div>
              )
          })
        ) : (
            <div className="text-center py-8 text-xs text-slate-400 italic">
                Pas assez de données pour ce classement.
                <br/>(Min. 3 essais par modèle requis)
            </div>
        )}
      </div>
      
      {/* FOOTER */}
      <div className="mt-4 pt-3 border-t border-slate-50 text-[9px] text-slate-400 text-center font-medium uppercase tracking-wide">
        {activeTab === 'score' && "Classé par moyenne générale"}
        {activeTab === 'power' && "Les fiches techniques les plus extrêmes"}
        {activeTab === 'smart' && "Meilleurs scores • Puissance médiane"}
      </div>

    </div>
  );
}