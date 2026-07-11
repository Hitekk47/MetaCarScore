import { calculateDistribution } from "@/lib/utils";

type Props = {
  scores: number[];
};

export default function ScoreDistribution({ scores }: Props) {
  const { positive, mixed, negative, total } = calculateDistribution(scores);
  if (total === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">
        Répartition des avis
      </h3>

      {/* LA BARRE VISUELLE */}
      <div className="flex h-4 w-full rounded-full overflow-hidden mb-4">
        {/* Segment Positif */}
        <div style={{ width: `${(positive.count / total) * 100}%` }} className="bg-score-good transition-all duration-1000"></div>
        {/* Segment Mitigé */}
        <div style={{ width: `${(mixed.count / total) * 100}%` }} className="bg-score-mixed transition-all duration-1000"></div>
        {/* Segment Négatif */}
        <div style={{ width: `${(negative.count / total) * 100}%` }} className="bg-score-bad transition-all duration-1000"></div>
      </div>

      {/* LÉGENDE DÉTAILLÉE */}
      <div className="space-y-3">
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-score-good"></div>
            <span className="font-bold text-slate-700">Positifs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400 text-xs">{positive.count} avis</span>
            <span className="font-bold text-slate-900 w-8 text-right">{positive.percentage}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-score-mixed"></div>
            <span className="font-bold text-slate-700">Mitigés</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400 text-xs">{mixed.count} avis</span>
            <span className="font-bold text-slate-900 w-8 text-right">{mixed.percentage}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-score-bad"></div>
            <span className="font-bold text-slate-700">Négatifs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400 text-xs">{negative.count} avis</span>
            <span className="font-bold text-slate-900 w-8 text-right">{negative.percentage}%</span>
          </div>
        </div>

      </div>
    </div>
  );
}
