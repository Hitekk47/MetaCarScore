import Link from "next/link";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSlug } from "@/lib/slugify";
import ScoreBadge from "@/components/ui/ScoreBadge";
import { BrandRankingItem } from "@/lib/types";

type BrandPodiumStepProps = {
  item: BrandRankingItem;
  rank: number;
};

export default function BrandPodiumStep({ item, rank }: BrandPodiumStepProps) {
    const isFirst = rank === 1;
    const modelUrl = item.best_model && item.best_famille && item.best_my
        ? `/${toSlug(item.brand)}/${toSlug(item.best_famille)}/${item.best_my}/${toSlug(item.best_model)}`
        : null;

    return (
        <div className={cn("flex flex-col items-center relative group transition-transform hover:scale-105", isFirst ? "w-1/3 z-10 -mt-8" : "w-1/4 z-0 opacity-90 hover:opacity-100")}>
            <Link href={`/${toSlug(item.brand)}`} className="absolute inset-0 z-10" aria-label={`Voir la marque ${item.brand}`} />
            {isFirst && <Crown size={32} className="text-yellow-400 mb-2 drop-shadow-sm animate-bounce" />}
            <div className={cn("bg-white border rounded-xl shadow-lg flex flex-col items-center w-full relative overflow-visible", isFirst ? "p-2 md:p-4 border-yellow-400 ring-2 md:ring-4 ring-yellow-100" : "p-2 md:p-3 border-slate-200")}>
                <div className={cn("absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center font-black text-[10px] md:text-xs text-white shadow-sm z-20 pointer-events-none", rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-slate-400" : "bg-orange-400")}>{rank}</div>
                <h3 className={cn("font-black uppercase text-slate-900 text-center truncate w-full mt-2 md:mt-2", isFirst ? "text-sm md:text-2xl" : "text-[10px] md:text-sm")}>{item.brand}</h3>
                <span className="text-[9px] md:text-[10px] font-medium text-slate-400 mb-2 whitespace-nowrap">{item.review_count} essais</span>
                <ScoreBadge score={Math.round(item.avg_score)} size={isFirst ? "md" : "sm"} />

                {item.best_model && modelUrl && (
                    <div className="mt-2 pt-2 border-t border-slate-50 w-full text-center relative z-20">
                        <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-bold tracking-tight">Star</p>
                        <Link href={modelUrl} className="block truncate w-full px-0.5"><span className="text-[9px] md:text-[10px] font-medium text-emerald-600 hover:text-blue-600 hover:underline transition-colors truncate">{item.best_model}</span></Link>
                    </div>
                )}
            </div>
            <div className={cn("w-full bg-gradient-to-b from-slate-100 to-transparent rounded-t-lg mt-2", isFirst ? "h-12 md:h-24" : rank === 2 ? "h-8 md:h-16" : "h-4 md:h-10")}></div>
        </div>
    );
}
