import { Review } from "@/lib/types";
import ScoreBadge from "../ui/ScoreBadge";
import Powertrain from "../ui/Powertrain";

export default function ReviewsTableCompact({ data }: { data: Review[] }) {
  
  const formatYearMonth = (dateStr: string) => {
    if (!dateStr) return "";
    return dateStr.substring(0, 7);
  };

  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="py-2 px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[60px] text-center">Score</th>
            <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">MY</th>
            <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Modèle / Finition</th>
            <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Moteur</th>
            <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            // Hauteur réduite à h-14 (56px) pour plus de densité
            <tr key={row.supabase_id} className="group hover:bg-slate-50 transition-colors cursor-pointer h-14">
              
              {/* SCORE : Le badge remplit presque toute la hauteur */}
              <td className="p-1 align-middle text-center">
                 <div className="inline-block transform transition-transform group-hover:scale-110">
                    <ScoreBadge score={row.Score} size="md" /> 
                 </div>
              </td>

              {/* ANNÉE */}
              <td className="px-3 py-1 text-xs font-mono font-bold text-slate-500 align-middle">
                {row.MY}
              </td>

              {/* MODÈLE */}
              <td className="px-3 py-1 align-middle">
                <div className="flex flex-col justify-center">
                  <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition leading-none mb-1">
                    {row.Marque} {row.Modele}
                  </span>
                  {row.Finition && (
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide truncate max-w-[150px]">
                      {row.Finition}
                    </span>
                  )}
                </div>
              </td>

              {/* MOTEUR */}
              <td className="px-3 py-1 align-middle">
                <Powertrain 
                  power={row.Puissance} 
                  transmission={row.Transmission} 
                  type={row.Type} 
                />
              </td>

              {/* DATE */}
              <td className="px-3 py-1 hidden md:table-cell align-middle">
                <div className="flex flex-col items-start justify-center">
                  <span className="text-[10px] font-bold text-slate-700 uppercase">{row.Testeur}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatYearMonth(row.Test_date)}
                  </span>
                </div>
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}