import { magazineCountries, normalizeSourceName } from "@/lib/config/magazines";

interface MagazineBadgeProps {
  name: string;
  className?: string;
}

/**
 * A style-agnostic component that prepends a country flag to a magazine name.
 * Uses flag-icons (SVG) for consistent cross-platform rendering (including Windows).
 */
export const MagazineBadge = ({ name, className = "" }: MagazineBadgeProps) => {
  const normalized = normalizeSourceName(name);
  const countryCode = magazineCountries[normalized];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {countryCode ? (
        <span
          className={`fi fi-${countryCode} shrink-0 rounded-sm shadow-sm border border-slate-100/10`}
          aria-hidden="true"
        />
      ) : (
        <span className="select-none text-[1.1em] leading-none" aria-hidden="true">🌐</span>
      )}
      <span>{name}</span>
    </span>
  );
};
