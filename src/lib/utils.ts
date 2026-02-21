import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Review, AggregatedSource } from "@/lib/types";

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

/**
 * Stringifies an object and escapes the '<' character to prevent XSS in <script> tags.
 */
export function serializeJsonLd(data: any) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function aggregateReviews(reviews: Review[]): Record<string, AggregatedSource> {
  const map: Record<string, AggregatedSource> = {};
  reviews.forEach((r) => {
    const source = r.Testeur.trim();
    if (!map[source]) map[source] = { sourceName: source, avgScore: 0, count: 0, rawScores: [] };
    map[source].rawScores.push(r.Score);
    map[source].count += 1;
  });
  Object.values(map).forEach((item) => {
    const total = item.rawScores.reduce((a, b) => a + b, 0);
    item.avgScore = Math.round(total / item.count);
  });
  return map;
}

export function getPowerRange(reviews: Review[]) {
    const powers = reviews.map(r => r.Puissance).filter(p => p > 0);
    if (powers.length === 0) return null;
    const min = Math.min(...powers);
    const max = Math.max(...powers);
    return min === max ? `${min} ch` : `${min} - ${max} ch`;
}
