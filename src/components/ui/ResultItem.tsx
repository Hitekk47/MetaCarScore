import { SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Layers, CarFront, Clock, ChevronRight } from "lucide-react";

type ResultItemProps = {
  res: SearchResult;
  onClick: () => void;
  isActive: boolean;
  isHistory?: boolean;
};

export default function ResultItem({ res, onClick, isActive, isHistory = false }: ResultItemProps) {
  const isFamily = res.Type === 'family';

  return (
    <div onClick={onClick} className={cn("px-4 py-3 cursor-pointer flex items-center justify-between group/item transition-colors border-b border-slate-50 last:border-0", isActive ? "bg-blue-50" : (isFamily ? "bg-slate-50/50 hover:bg-blue-50" : "hover:bg-slate-50"))}>

      {/* CONTENEUR GAUCHE */}
      <div className="flex items-center gap-3 overflow-hidden w-full relative">

          {/* ICONE : Modifiée pour intégrer le badge historique */}
          <div className={cn(
              "w-8 h-8 rounded flex items-center justify-center transition shrink-0 relative z-20",
              // On garde le style sémantique (Noir pour Gamme, Blanc pour Modèle) même en historique
              isFamily ? "bg-slate-900 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-400 group-hover/item:text-blue-600 group-hover/item:border-blue-200"
          )}>
              {/* L'icône principale est toujours sémantique */}
              {isFamily ? <Layers size={16} /> : <CarFront size={16} />}

              {/* Badge Horloge superposé si historique */}
              {isHistory && (
                  <div className="absolute -bottom-1 -right-1 bg-slate-100 rounded-full p-[2px] border-[1.5px] border-white shadow-sm text-slate-400 flex items-center justify-center">
                      <Clock size={8} strokeWidth={3} />
                  </div>
              )}
          </div>

          {/* CONTENEUR TEXTE */}
          <div className="truncate w-full relative z-10">
              {isFamily ? (
                <div className="flex flex-col">
                    {/* J'ai retiré !isHistory pour afficher "GAMME" même dans l'historique */}
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gamme</span>
                    <span className={cn("font-black text-slate-900 text-sm uppercase truncate", isHistory && "font-medium text-slate-600")}>
                        {res.Marque} {res.Famille}
                    </span>
                </div>
              ) : (
                <div className="flex flex-col relative w-full">

                    {/* LE FILIGRANE (Inchangé) */}
                    {res.MaxMY && !isHistory && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-4xl font-black text-slate-100 -z-10 select-none pointer-events-none italic tracking-tighter">
                            {res.MaxMY}
                        </span>
                    )}

                    <span className="text-xs font-bold text-slate-500 truncate relative z-10">
                        {res.Marque} {res.Famille}
                    </span>
                    <span className={cn("font-bold text-slate-900 text-sm uppercase truncate relative z-10", isHistory && "font-medium text-slate-600")}>
                        {res.Modele}
                    </span>
                </div>
              )}
          </div>
      </div>

      {/* CHEVRON */}
      <div className="pl-4 shrink-0 relative z-20">
        {isFamily && !isHistory ? <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 group-hover/item:text-blue-600 group-hover/item:border-blue-200 transition whitespace-nowrap">Vue d'ensemble</span> : <ChevronRight size={14} className="text-slate-300 group-hover/item:text-blue-600 transition" />}
      </div>
    </div>
  );
}
