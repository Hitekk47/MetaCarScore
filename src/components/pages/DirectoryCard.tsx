import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIRECTORY_ICONS, type DirectoryItem } from "./directory-types";

export default function DirectoryCard({ item, headingAs: Heading = "h3" }: { item: DirectoryItem; headingAs?: "h3" | "h5" }) {
  const Icon = item.iconName ? DIRECTORY_ICONS[item.iconName] : null;
  return (
    <Link href={item.href} className={cn(
      "group relative block min-h-40 overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
      item.colorClass
        ? item.colorClass.split(" ").filter(cls => cls.startsWith("bg-") || cls.startsWith("border-")).join(" ")
        : "bg-white border-slate-200 hover:border-slate-400"
    )}>
      <div aria-hidden="true" className="absolute -right-4 -bottom-6 opacity-10 pointer-events-none select-none transition-transform duration-500 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-12">
        {Icon ? <Icon size={140} /> : <span className="text-[160px] font-black leading-none tracking-tighter text-slate-900">{item.letter}</span>}
      </div>
      <div className="relative z-10 p-5 min-h-40 flex flex-col justify-between gap-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && !item.isAlias && <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", item.colorClass?.replace("bg-", "bg-opacity-20 "))}><Icon size={20} aria-hidden="true" /></div>}
            {item.isAlias && item.canonicalMarque && item.canonicalFamille && (
              <span className="inline-flex min-w-0 items-center gap-1 px-2 py-1 rounded-full bg-slate-900/10 border border-slate-900/15 text-[10px] font-bold text-slate-800">
                <span className="min-w-0 break-words">{item.canonicalMarque} {item.canonicalFamille}</span>
                <ExternalLink size={10} className="shrink-0" aria-hidden="true" />
              </span>
            )}
          </div>
          <span aria-hidden="true" className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shadow-sm shrink-0"><ChevronRight size={16} /></span>
        </div>
        <div className="min-w-0">
          <Heading className="text-xl font-black uppercase tracking-tight leading-tight mb-1 line-clamp-2 break-words">{item.title}</Heading>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.subtitle}</p>
        </div>
      </div>
    </Link>
  );
}
