import { Trophy } from "lucide-react";
import ScoreBadge from "@/components/ui/ScoreBadge";

type DuelScoreProps = {
  score: number;
  count: number;
  isWinner?: boolean;
};

export default function DuelScore({ score, count, isWinner }: DuelScoreProps) {
    return (
        <div className="flex flex-col items-center relative">
            <div className="relative">
                <ScoreBadge score={score} size="md" />
                {isWinner && (
                    <div className="absolute -top-3 -right-2 text-yellow-500 drop-shadow-sm animate-bounce">
                        <Trophy size={14} fill="currentColor" />
                    </div>
                )}
            </div>
            {count > 1 && (
                <span className="absolute top-full mt-1 text-[9px] text-slate-400 font-medium whitespace-nowrap">
                    Moy. de {count}
                </span>
            )}
        </div>
    );
}
