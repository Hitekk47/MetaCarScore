import { magazineCountries, normalizeSourceName } from "@/lib/config/magazines";

interface MagazineBadgeProps {
  name: string;
  className?: string;
}

/**
 * A lightweight UI component to display a magazine name with its country flag.
 * Handled in-memory for maximum SSR performance.
 */
export const MagazineBadge = ({ name, className = "" }: MagazineBadgeProps) => {
  const normalizedName = normalizeSourceName(name);
  const flag = magazineCountries[normalizedName] || "🌐";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 leading-tight uppercase ${className}`}
    >
      <span aria-hidden="true" className="text-sm leading-none">{flag}</span>
      <span className="truncate">{name}</span>
    </span>
  );
};
