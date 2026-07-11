type MiniScoreBarProps = {
  scores: number[];
};

export default function MiniScoreBar({ scores }: MiniScoreBarProps) {
    if (!scores || scores.length === 0) return null;

    const { positive, mixed, negative, total } = calculateDistribution(scores);

    return (
        <div className="flex h-1.5 w-16 md:w-24 rounded-full overflow-hidden bg-white/50 border border-slate-200 transition-all duration-300">
            <div style={{ width: `${(positive.count / total) * 100}%` }} className="bg-emerald-500"></div>
            <div style={{ width: `${(mixed.count / total) * 100}%` }} className="bg-yellow-400"></div>
            <div style={{ width: `${(negative.count / total) * 100}%` }} className="bg-red-500"></div>
        </div>
    );
}
