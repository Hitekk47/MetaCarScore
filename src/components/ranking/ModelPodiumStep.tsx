import Link from "next/link";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSlug } from "@/lib/slugify";
import ScoreBadge from "@/components/ui/ScoreBadge";
import { ModelRankingItem } from "@/lib/types";

type ModelPodiumStepProps = {
  item: ModelRankingItem;
  rank: number;
};

export default function ModelPodiumStep({ item, rank }: ModelPodiumStepProps) {
    const isFirst = rank === 1;
    return (
        <Link
            href={`/${toSlug(item.Marque)}/${toSlug(item.Famille)}/${item.MY}/${toSlug(item.Modele)}`}
            className={cn(
                "flex flex-col items-center relative group transition-transform hover:scale-105 text-center",
                // MOBILE : Largeur optimisée | DESKTOP : Retour au standard plus étroit
                isFirst ? "w-[35%] md:w-1/3 z-10 -mt-8" : "w-[31%] md:w-1/4 z-0 opacity-90 hover:opacity-100"
            )}
        >
            {isFirst && <Crown size={32} className="text-yellow-400 mb-2 drop-shadow-sm animate-bounce" />}

            <div className={cn(
                "bg-white border rounded-xl shadow-lg flex flex-col items-center w-full relative overflow-visible",
                // PADDING MOBILE : réduit (px-1) | PADDING DESKTOP : plus large (md:px-4)
                isFirst ? "py-4 px-1 md:px-4 border-yellow-400 ring-4 ring-yellow-100" : "py-3 px-1 md:px-3 border-slate-200"
            )}>
                <div className={cn("absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm z-20", rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-slate-400" : "bg-orange-400")}>{rank}</div>

                <div className="text-center w-full mt-2">
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{item.Marque}</div>

                    <h3 className={cn(
                        "font-black uppercase text-slate-900 leading-[1.1] w-full break-words",
                        // TEXTE MOBILE : Un peu plus petit pour le confort | DESKTOP : Normal
                        isFirst ? "text-sm md:text-lg" : "text-[10px] md:text-xs"
                    )}>
                        {item.Modele}
                    </h3>
                </div>

                <div className="mt-3">
                    <ScoreBadge score={Math.round(item.avg_score)} size={isFirst ? "lg" : "sm"} />
                </div>

                <div className="mt-3 pt-2 border-t border-slate-50 w-full text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none">Année</p>
                    <p className="text-xs font-bold text-slate-700">{item.MY}</p>
                </div>
            </div>

            <div className={cn("w-full bg-gradient-to-b from-slate-100 to-transparent rounded-t-lg mt-2", isFirst ? "h-12 md:h-24" : rank === 2 ? "h-8 md:h-16" : "h-4 md:h-10")}></div>
        </Link>
    );
}
