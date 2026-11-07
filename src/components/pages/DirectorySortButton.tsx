import { ArrowDownAZ } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DirectorySortButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const label = active ? "Trier par nombre d’essais" : "Trier par ordre alphabétique";
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} title={label} className={cn(
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:outline-blue-600",
      active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-900"
    )}>
      <ArrowDownAZ size={20} aria-hidden="true" />
    </button>
  );
}
