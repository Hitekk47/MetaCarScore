import { MACRO_CONFIG } from "./constants";

export interface SeoStats {
  review_count: number;
  metacarscore: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  consensus_label: string;
  distribution: {
    positive: { count: number; percentage: number };
    mixed: { count: number; percentage: number };
    negative: { count: number; percentage: number };
  };
  rank: number | null;
  total_in_segment: number | null;
  segment_avg: number | null;
  segments: { macro: string; size: string }[];
  is_reliable: boolean;
}

export function resolveSegmentLabel(macro: string, size: string): string {
  const macroEntry = MACRO_CONFIG.find(m => m.label === macro);
  if (!macroEntry) return `${macro} ${size}`;
  const segment = macroEntry.segments.find(s => s.code === size);
  return segment ? segment.label : `${macro} ${size}`;
}

export function generateSeoText(
  data: SeoStats,
  context: { marque: string; famille: string; my?: string; modele?: string; level: 'family' | 'my' | 'modele' | 'powertrain' }
): string {
  const { marque, famille, my, modele, level } = context;

  const consensusIntro = data.consensus_label === 'consensus' ? "d'un consensus" : (data.consensus_label === 'certaines nuances' ? 'de certaines nuances' : "d'une forte division");

  if (!data.is_reliable) {
    const name = (level === 'modele' || level === 'powertrain') ? `${marque} ${modele}` : (level === 'my' ? `${my} ${famille}` : famille);
    return `Sur la base de ${data.review_count} essai${data.review_count > 1 ? 's' : ''}, le ${name} ne dispose pas encore d'un MetaCarScore consolidé. La presse fait état ${consensusIntro} autour de ce véhicule (Écart interquartile : ${data.iqr}). Les avis sont répartis majoritairement ${getDistributionPhrasing(data.distribution)}.`;
  }

  const segmentLabels = data.segments.map(s => resolveSegmentLabel(s.macro, s.size));
  const segmentText = segmentLabels.length > 0
    ? (segmentLabels.length === 1 ? `le segment des ${segmentLabels[0]}` : `les segments ${segmentLabels.join(', ')}`)
    : "son segment de marché";

  const comparisonText = data.rank && data.total_in_segment && data.segment_avg
    ? `Il se classe actuellement ${data.rank}/${data.total_in_segment} de sa catégorie, ${data.metacarscore >= data.segment_avg ? 'au-dessus' : 'en-dessous'} de la moyenne du segment qui est de ${data.segment_avg}.`
    : "";

  if (level === 'modele' || level === 'powertrain') {
    return `Le ${marque} ${modele} s'inscrit dans ${segmentText}. Sur la base de ${data.review_count} essais, il obtient le MetaCarScore de ${data.metacarscore}. La presse fait état ${consensusIntro} autour de ce véhicule (Écart interquartile : ${data.iqr}). Les avis sont répartis majoritairement ${getDistributionPhrasing(data.distribution)}. ${comparisonText}`;
  }

  if (level === 'my') {
    return `L'année-modèle ${my} de la ${marque} ${famille} couvre ${segmentText}. Sur la base de ${data.review_count} essais, elle obtient le MetaCarScore de ${data.metacarscore}. La presse fait état ${consensusIntro} (Écart interquartile : ${data.iqr}). Les avis sont répartis majoritairement ${getDistributionPhrasing(data.distribution)}. ${comparisonText}`;
  }

  // Family level
  return `La gamme ${marque} ${famille} couvre ${segmentText}. Sur la base de ${data.review_count} essais cumulés, elle obtient le MetaCarScore de ${data.metacarscore}. La presse fait état ${consensusIntro} sur l'ensemble de la gamme (Écart interquartile : ${data.iqr}). Les avis sont répartis majoritairement ${getDistributionPhrasing(data.distribution)}. ${comparisonText}`;
}

function getDistributionPhrasing(dist: SeoStats['distribution']): string {
  const { positive, mixed, negative } = dist;
  const categories = [
    { label: 'positifs', ...positive },
    { label: 'mitigés', ...mixed },
    { label: 'négatifs', ...negative }
  ];

  const maxPercent = Math.max(...categories.map(c => c.percentage));
  const topCategories = categories.filter(c => c.percentage === maxPercent);

  if (topCategories.length === 3) {
    return `de manière équilibrée entre positifs, mitigés et négatifs (${maxPercent}% chacun)`;
  }

  if (topCategories.length === 2) {
    return `partagés entre ${topCategories[0].label} et ${topCategories[1].label} (à égalité, ${maxPercent}% chacun)`;
  }

  return `${topCategories[0].label} (${maxPercent}%)`;
}
