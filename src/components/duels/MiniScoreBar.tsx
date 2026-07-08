type MiniScoreBarProps = {
  scores: number[];
};

export default function MiniScoreBar({ scores }: MiniScoreBarProps) {
    if (!scores || scores.length === 0) return null;
    const total = scores.length;
    let positive = 0;
    let mixed = 0;
    let negative = 0;

    for (let i = 0; i < total; i++) {
        const s = scores[i];
        if (s >= 75) positive++;
        else if (s >= 50 && s < 75) mixed++;
        else if (s < 50) negative++;
    }

    return (
        <div className="flex h-1.5 w-16 md:w-24 rounded-full overflow-hidden bg-white/50 border border-slate-200 transition-all duration-300">
            <div style={{ width: `${(positive / total) * 100}%` }} className="bg-emerald-500"></div>
            <div style={{ width: `${(mixed / total) * 100}%` }} className="bg-yellow-400"></div>
            <div style={{ width: `${(negative / total) * 100}%` }} className="bg-red-500"></div>
        </div>
    );
}
