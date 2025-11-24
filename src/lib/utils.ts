import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getScoreColor = (score: number) => {
  // > 75 : VERT
  if (score >= 75) {
    return { 
      bg: "bg-score-good", 
      text: "text-black", 
      border: "border-score-good", 
      light: "bg-score-good/10" 
    };
  }
  
  // > 50 : JAUNE
  if (score >= 50) {
    return { 
      bg: "bg-score-mixed", 
      text: "text-black", 
      border: "border-score-mixed", 
      light: "bg-score-mixed/10" 
    };
  }

  // < 50 : ROUGE
  return { 
    bg: "bg-score-bad", 
    text: "text-white", 
    border: "border-score-bad", 
    light: "bg-score-bad/10" 
  };
};
export const formatReviewDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  // On force le format Mois (long) + Année
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
};

// Petite fonction helper pour grouper les données
export const groupBy = <T, K extends keyof any>(list: T[], getKey: (item: T) => K) =>
  list.reduce((previous, currentItem) => {
    const group = getKey(currentItem);
    if (!previous[group]) previous[group] = [];
    previous[group].push(currentItem);
    return previous;
  }, {} as Record<K, T[]>);