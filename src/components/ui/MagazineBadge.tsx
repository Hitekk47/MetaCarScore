import { magazineCountries, normalizeSourceName } from "@/lib/config/magazines";

interface MagazineBadgeProps {
  name: string;
  className?: string;
}

/**
 * A style-agnostic component that prepends a country flag to a magazine name.
 * Inherits typography and layout from its parent for a seamless look.
 */
export const MagazineBadge = ({ name, className = "" }: MagazineBadgeProps) => {
  const normalized = normalizeSourceName(name);
  const flag = magazineCountries[normalized] || "🌐";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="select-none text-base leading-none">{flag}</span>
      <span>{name}</span>
    </span>
  );
};
