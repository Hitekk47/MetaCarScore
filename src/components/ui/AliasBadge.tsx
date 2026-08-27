import { ModelAlias } from "@/lib/types";
import { Info } from "lucide-react";

interface AliasBadgeProps {
  canonicalMarque: string;
  aliases: ModelAlias[];
}

export default function AliasBadge({ canonicalMarque, aliases }: AliasBadgeProps) {
  if (!aliases || aliases.length === 0) return null;

  // Extract unique display names based on brand rule:
  // Show brand only if alias brand differs from canonical brand
  const formattedNamesSet = new Set<string>();

  aliases.forEach((alias) => {
    const aliasNamePart = alias.alias_modele || alias.alias_famille;
    const sameBrand = alias.alias_marque.trim().toLowerCase() === canonicalMarque.trim().toLowerCase();

    if (sameBrand) {
      formattedNamesSet.add(aliasNamePart);
    } else {
      formattedNamesSet.add(`${alias.alias_marque} ${aliasNamePart}`);
    }
  });

  const formattedNames = Array.from(formattedNamesSet);
  if (formattedNames.length === 0) return null;

  const isPlural = formattedNames.length > 1;
  const labelPrefix = isPlural
    ? "Également commercialisé sous les noms :"
    : "Également commercialisé sous le nom :";

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/80 border border-blue-100 text-blue-900 text-xs sm:text-sm font-medium my-2">
      <Info size={16} className="text-blue-600 shrink-0" />
      <span>
        <span className="text-blue-700/80 mr-1">{labelPrefix}</span>
        <span className="font-semibold text-blue-950">
          {formattedNames.join(", ")}
        </span>
      </span>
    </div>
  );
}
