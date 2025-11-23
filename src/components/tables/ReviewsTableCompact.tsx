import { Review } from "@/lib/types";
import ScoreBadge from "../ui/ScoreBadge";
import Powertrain from "../ui/Powertrain";

export default function ReviewsTableCompact({ data }: { data: Review[] }) {
  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">Score</th>
            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">MY</th>
            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Modèle / Finition</th>
            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Moteur</th>
            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            <tr key={row.supabase_id} className="group hover:bg-slate-50 transition-colors cursor-pointer">
              
              {/* 1. SCORE (Highlight visuel) */}
              <td className="p-2 text-center">
                 <div className="inline-block scale-75 origin-center">
                    <ScoreBadge score={row.Score} size="sm" />
                 </div>
              </td>

              {/* 2. ANNÉE */}
              <td className="p-3 text-xs font-mono font-medium text-slate-500">
                {row.MY}
              </td>

              {/* 3. MODÈLE (Info principale) */}
              <td className="p-3">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">
                    {row.Marque} {row.Modele}
                  </span>
                  {row.Finition && (
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                      {row.Finition}
                    </span>
                  )}
                </div>
              </td>

              {/* 4. MOTORISATION (Composant Riche) */}
              <td className="p-3">
                <Powertrain 
                  power={row.Puissance} 
                  transmission={row.Transmission} 
                  type={row.Type} 
                />
              </td>

              {/* 5. TESTEUR (Méta-donnée) */}
              <td className="p-3 hidden md:table-cell">
                <div className="flex flex-col items-start">
                  <span className="text-xs font-bold text-slate-700">{row.Testeur}</span>
                  <span className="text-[10px] text-slate-400">{row.Test_date}</span>
                </div>
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}