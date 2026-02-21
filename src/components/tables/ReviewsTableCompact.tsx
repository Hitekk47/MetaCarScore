import Link from "next/link";
import { Review } from "@/lib/types";
import ScoreBadge from "../ui/ScoreBadge";
import Powertrain from "../ui/Powertrain";
import { toSlug } from "@/lib/slugify";

export default function ReviewsTableCompact({ data, hideBrand = false }: { data: Review[], hideBrand?: boolean }) {
  
  const formatYearMonth = (dateStr: string) => {
    if (!dateStr) return "";
    return dateStr.substring(0, 7);
  };

  return (
    <div className="w-full border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="py-2 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[50px] md:w-[70px] text-center">Score</th>
            
            {/* MY (Desktop uniquement, car sur mobile il est en filigrane) */}
            <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 hidden md:table-cell">MY</th>
            
            <th className="py-2 px-2 md:px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Véhicule</th>
            <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Moteur</th>
            <th className="py-2 px-2 md:px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px] md:w-auto text-right md:text-left">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, index) => {
            const marqueSlug = toSlug(row.Marque);
            const familleSlug = toSlug(row.Famille);
            const modeleSlug = toSlug(row.Modele);
            const typeSlug = toSlug(row.Type);

            const baseHref = `/${marqueSlug}/${familleSlug}/${row.MY}`;
            const modelHref = `${baseHref}/${modeleSlug}`;
            const powertrainHref = `${modelHref}/${typeSlug}_${row.Puissance}_${row.Transmission}`;

            return (
              <tr key={`${row.supabase_id}-${index}`} className="group hover:bg-slate-50 transition-colors h-14 md:h-14">
                
                {/* 1. SCORE */}
                <td className="p-1 align-middle text-center">
                   <div className="inline-block transform transition-transform group-hover:scale-110">
                      <ScoreBadge score={row.Score} size="md" />
                   </div>
                </td>

                {/* 2. MY (Desktop Only) */}
                <td className="px-3 py-1 align-middle hidden md:table-cell">
                  <Link 
                    href={baseHref}
                    className="text-xs font-mono font-bold text-slate-500 hover:text-blue-600 hover:underline decoration-blue-600 decoration-2 underline-offset-2 transition-all"
                  >
                    {row.MY}
                  </Link>
                </td>

                {/* 3. MODÈLE (Avec Filigrane Mobile) */}
                <td className="px-2 md:px-3 py-2 align-middle relative overflow-hidden">
                  
                  {/* --- FILIGRANE MOBILE --- */}
                  {/* z-0 : Reste au niveau de base, mais derrière le z-10 */}
                  <div className="md:hidden absolute right-1 top-1/2 -translate-y-1/2 text-5xl font-black text-slate-100 select-none pointer-events-none italic tracking-tighter z-0">
                      {row.MY}
                  </div>

                  {/* --- CONTENU --- */}
                  {/* z-10 relative : Passe DEVANT le filigrane */}
                  <div className="flex flex-col justify-center gap-0.5 relative z-10">

                    <Link
                      href={modelHref}
                      className="font-bold text-xs md:text-sm text-slate-900 group-hover:text-blue-600 transition leading-tight truncate max-w-[180px] md:max-w-none block"
                    >
                      {hideBrand ? row.Modele : `${row.Marque} ${row.Modele}`}
                    </Link>

                    {row.Finition && (
                      <span className="text-[9px] md:text-[11px] text-slate-500 font-medium tracking-tight truncate max-w-[150px] leading-none">
                        {row.Finition}
                      </span>
                    )}

                    <div className="md:hidden mt-1 origin-left transform scale-90">
                      <Link href={powertrainHref}>
                          <Powertrain
                              power={row.Puissance}
                              transmission={row.Transmission}
                              type={row.Type}
                          />
                      </Link>
                    </div>
                  </div>
                </td>

                {/* 4. POWERTRAIN (Desktop Only) */}
                <td className="px-3 py-1 align-middle hidden md:table-cell">
                  <Link
                    href={powertrainHref}
                    className="block w-fit hover:opacity-80 transition-opacity"
                  >
                    <Powertrain
                      power={row.Puissance}
                      transmission={row.Transmission}
                      type={row.Type}
                    />
                  </Link>
                </td>

              {/* 5. SOURCE */}
              <td className="px-2 md:px-3 py-1 align-middle text-right md:text-left">
                <div className="flex flex-col items-end md:items-start justify-center leading-tight">
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-700 uppercase truncate max-w-[80px] md:max-w-none">{row.Testeur}</span>
                  <span className="text-[9px] md:text-[10px] text-slate-400 font-mono">
                    {formatYearMonth(row.Test_date)}
                  </span>
                </div>
              </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}