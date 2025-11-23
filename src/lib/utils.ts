import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getScoreColor = (score: number) => {
  if (score >= 90) return { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500", light: "bg-emerald-500/10" };
  if (score >= 75) return { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-600", light: "bg-emerald-600/10" }; // Le "Vert Metacritic"
  if (score >= 50) return { bg: "bg-amber-400", text: "text-amber-500", border: "border-amber-400", light: "bg-amber-400/10" };
  return { bg: "bg-red-500", text: "text-red-500", border: "border-red-500", light: "bg-red-500/10" };
};

export const getFuelIcon = (type: string) => {
  switch (type) {
    case 'Électrique': 
      return '⚡';
    case 'Hybride Essence': 
    case 'Hybride diesel': 
      return '🔋'; // Batterie pour les hybrides
    case 'Hydrogène': 
      return '💧'; // Goutte d'eau
    case 'Gas naturel': 
      return '☁️'; // Nuage/Gaz
    case 'FlexFuel (Ethanol)': 
      return '🌿'; // Feuille pour le bio-éthanol
    case 'Diesel': 
      return '⛽'; // Pompe standard
    default: 
      return '⛽'; // Essence par défaut
  }
};