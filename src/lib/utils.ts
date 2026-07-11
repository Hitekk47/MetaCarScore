import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Review, AggregatedSource } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ScoreCategory = 'positive' | 'mixed' | 'negative';

export const getScoreCategory = (score: number): ScoreCategory => {
  if (score >= 75) return 'positive';
  if (score >= 50) return 'mixed';
  return 'negative';
};

export const getScoreColor = (score: number) => {
  const category = getScoreCategory(score);

  if (category === 'positive') {
    return { 
      bg: "bg-score-good", 
      text: "text-black", 
      border: "border-score-good", 
      light: "bg-score-good/10" 
    };
  }
  
  if (category === 'mixed') {
    return { 
      bg: "bg-score-mixed", 
      text: "text-black", 
      border: "border-score-mixed", 
      light: "bg-score-mixed/10" 
    };
  }

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
export const groupBy = <T, K extends PropertyKey>(list: T[], getKey: (item: T) => K) =>
  list.reduce((previous, currentItem) => {
    const group = getKey(currentItem);
    if (!previous[group]) previous[group] = [];
    previous[group].push(currentItem);
    return previous;
  }, Object.create(null) as Record<K, T[]>);

/**
 * Stringifies an object and escapes potentially dangerous characters to prevent XSS in <script> tags.
 */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function calculateDistribution(scores: number[]) {
  const total = scores.length;
  if (total === 0) return { positive: 0, mixed: 0, negative: 0, pPos: 0, pMix: 0, pNeg: 0 };

  let positive = 0;
  let mixed = 0;
  let negative = 0;

  for (const s of scores) {
    const cat = getScoreCategory(s);
    if (cat === 'positive') positive++;
    else if (cat === 'mixed') mixed++;
    else negative++;
  }

  return {
    positive,
    mixed,
    negative,
    pPos: Math.round((positive / total) * 100),
    pMix: Math.round((mixed / total) * 100),
    pNeg: Math.round((negative / total) * 100),
  };
}

export function aggregateReviews(reviews: Review[]): Record<string, AggregatedSource> {
  const map: Record<string, AggregatedSource> = Object.create(null);
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

export function calculatePageStats(filteredReviews: Review[]) {
  let scoreSum = 0;
  let minYear = Infinity;
  let maxYear = -Infinity;
  let minPowerStat = Infinity;
  let maxPowerStat = -Infinity;
  let validYearsCount = 0;
  let validPowersCount = 0;

  const length = filteredReviews.length;
  const scores = new Array(length);

  for (let i = 0; i < length; i++) {
    const r = filteredReviews[i];
    const score = r.Score;

    scores[i] = score;
    scoreSum += score;

    if (r.MY > 0) {
      if (r.MY < minYear) minYear = r.MY;
      if (r.MY > maxYear) maxYear = r.MY;
      validYearsCount++;
    }

    if (r.Puissance > 0) {
      if (r.Puissance < minPowerStat) minPowerStat = r.Puissance;
      if (r.Puissance > maxPowerStat) maxPowerStat = r.Puissance;
      validPowersCount++;
    }
  }

  const avgScore = length > 0 ? Math.round(scoreSum / length) : 0;
  minYear = validYearsCount > 0 ? minYear : 0;
  maxYear = validYearsCount > 0 ? maxYear : 0;
  minPowerStat = validPowersCount > 0 ? minPowerStat : 0;
  maxPowerStat = validPowersCount > 0 ? maxPowerStat : 0;

  return { avgScore, minYear, maxYear, minPowerStat, maxPowerStat, scores };
}

export function getPowerRange(reviews: Review[]) {
    const powers = reviews.map(r => r.Puissance).filter(p => p > 0);
    if (powers.length === 0) return null;
    const min = Math.min(...powers);
    const max = Math.max(...powers);
    return min === max ? `${min} ch` : `${min} - ${max} ch`;
}
