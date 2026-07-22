import { MACRO_CONFIG, GrammaticalGender } from "./constants";

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

export function formatOrdinal(n: number): string {
  if (n === 1) return "1er";
  return `${n}e`;
}

export function resolveSegmentLabel(macro: string, size: string): string {
  const macroEntry = MACRO_CONFIG.find(m => m.label === macro);
  if (!macroEntry) return size;
  const segment = macroEntry.segments.find(s => s.code === size);
  return segment ? segment.label : size;
}

export function getSegmentGender(macro: string): GrammaticalGender {
  const macroEntry = MACRO_CONFIG.find(m => m.label === macro);
  return macroEntry?.gender ?? "masculine";
}

/**
 * Nettoie les balises internes de template du texte SEO (ex: [[iqr:type|label]])
 * pour ne garder que le texte brut, utilisable dans les métadonnées.
 */
export function cleanSeoText(text: string): string {
  if (!text) return "";
  return text.replace(/\[\[(.*?):(.*?)\|(.*?)\]\]/g, '$3');
}

function formatSegmentPhrasing(segments: { macro: string; size: string }[], level: string): string {
  if (segments.length === 0) return "";

  const resolved = segments.map(s => {
    const macroEntry = MACRO_CONFIG.find(m => m.label === s.macro);
    if (!macroEntry) return null;
    const segment = macroEntry.segments.find(seg => seg.code === s.size);
    if (!segment) return null;
    return { label: segment.label, macro: s.macro, size: s.size };
  });

  if (resolved.some(r => r === null)) return "";

  const validResolved = resolved as { label: string; macro: string; size: string }[];

  const wrap = (r: { label: string; macro: string; size: string }) => `[[segment:${r.macro}:${r.size}|${r.label}]]`;

  if (level === 'my' || level === 'family') {
    if (validResolved.length === 1) {
      const { label, macro, size } = validResolved[0];
      const des = (macro === "Sport / Coupé / Cab" && size === "GT") ? "" : "des ";
      return `couvre le segment ${des}${wrap(validResolved[0])}`;
    }
    const labels = validResolved.map(r => wrap(r));
    const last = labels.pop();
    return `couvre les segments ${labels.join(', ')} et ${last}`;
  }

  // Model/Powertrain level
  if (validResolved.length === 1) {
    const { label, macro, size } = validResolved[0];
    if (macro === "Sport / Coupé / Cab" && size === "GT") {
      return `appartient au segment ${wrap(validResolved[0])}`;
    }
    if (macro === "Utilitaire / Pickup") {
      return `appartient au segment des utilitaires / pickups ${wrap(validResolved[0])}`;
    }
    return `appartient au segment des ${wrap(validResolved[0])}`;
  }

  const labels = validResolved.map(r => wrap(r));
  const last = labels.pop();
  return `couvre les segments ${labels.join(', ')} et ${last}`;
}

export function generateSeoText(
  data: SeoStats,
  context: { marque: string; famille: string; my?: string; modele?: string; level: 'family' | 'my' | 'modele' | 'powertrain' }
): string {
  const { marque, famille, my, modele, level } = context;

  if (!data.is_reliable) {
    return "";
  }

  // Casting explicit pour s'assurer des calculs numériques corrects (le SQL peut renvoyer des strings pour les aggrégats)
  const rank = data.rank ? Number(data.rank) : null;
  const total = data.total_in_segment ? Number(data.total_in_segment) : null;
  const avg = data.segment_avg ? Math.round(Number(data.segment_avg)) : null;
  const score = Number(data.metacarscore);

  const gender = data.segments.length > 0 ? getSegmentGender(data.segments[0].macro) : "masculine";
  const vehicleArticle = gender === "feminine" ? "La" : "Le";
  const vehiclePronoun = gender === "feminine" ? "elle" : "il";
  const vehicleDeArticle = gender === "feminine" ? "de la" : "du";

  const pronounToUse = (level === 'my' || level === 'family') ? "elle" : vehiclePronoun;
  const subject = (level === 'my') ? "cette année-modèle" : (level === 'family' ? "cette gamme" : "ce véhicule");

  const STRONG_MAJORITY_THRESHOLD = 75;
  const posPercent = data.distribution.positive.percentage;
  const negPercent = data.distribution.negative.percentage;

  let consensusSentence = "";
  let skipDistribution = false;

  if (data.consensus_label === 'consensus') {
    if (posPercent >= STRONG_MAJORITY_THRESHOLD) {
      consensusSentence = `La presse se montre [[iqr:consensus|unanimement favorable]], avec ${posPercent} % d’avis positifs.`;
      skipDistribution = true;
    } else if (negPercent >= STRONG_MAJORITY_THRESHOLD) {
      consensusSentence = `La presse se montre [[iqr:consensus|unanimement critique]], avec ${negPercent} % d’avis négatifs.`;
      skipDistribution = true;
    } else {
      consensusSentence = `La presse affiche un [[iqr:consensus|large consensus]] autour de ${subject}.`;
    }
  } else if (data.consensus_label === 'certaines nuances') {
    consensusSentence = `Les critiques de la presse restent globalement convergentes, malgré quelques [[iqr:nuance|divergences d’appréciation]] autour de ${subject}.`;
  } else {
    // Cas de forte division (ou autre label non couvert au-dessus)
    if (posPercent >= STRONG_MAJORITY_THRESHOLD) {
      consensusSentence = `La presse se montre très favorable dans l’ensemble (${posPercent} % d’avis positifs), même si les [[iqr:division|appréciations restent contrastées]].`;
      skipDistribution = true;
    } else if (negPercent >= STRONG_MAJORITY_THRESHOLD) {
      consensusSentence = `La presse se montre très critique dans l’ensemble (${negPercent} % d’avis négatifs), même si les [[iqr:division|appréciations restent contrastées]].`;
      skipDistribution = true;
    } else {
      consensusSentence = `La presse est [[iqr:division|fortement divisée]] au sujet de ${subject}.`;
    }
  }

  const segmentPhrasing = formatSegmentPhrasing(data.segments, level);

  const isMultiSegment = data.segments.length > 1;
  const comparisonText = (rank !== null && total !== null && avg !== null)
    ? `${pronounToUse.charAt(0).toUpperCase() + pronounToUse.slice(1)} se classe actuellement ${formatOrdinal(rank)}/${total} ${isMultiSegment ? 'de ses catégories' : 'de sa catégorie'}, ${score >= avg ? '[[stats:above|au-dessus]]' : '[[stats:below|en-dessous]]'} de la moyenne ${isMultiSegment ? 'des segments' : 'du segment'} qui est de ${avg}.`
    : "";

  const distributionText = skipDistribution ? "" : `Les avis sont majoritairement ${getDistributionPhrasing(data.distribution)}.`;

  if (level === 'modele' || level === 'powertrain') {
    const parts = [
      segmentPhrasing
        ? `${vehicleArticle} ${marque} ${modele} ${segmentPhrasing}. Sur la base de ${data.review_count} essais, ${vehiclePronoun} obtient un MetaCarScore de ${score}.`
        : `Sur la base de ${data.review_count} essais, ${vehicleArticle.toLowerCase()} ${marque} ${modele} obtient un MetaCarScore de ${score}.`,
      consensusSentence,
      distributionText,
      comparisonText
    ];
    return parts.filter(Boolean).join(" ").trim().replace(/\s+/g, ' ');
  }

  if (level === 'my') {
    const parts = [
      segmentPhrasing
        ? `L'année-modèle ${my} ${vehicleDeArticle} ${marque} ${famille} ${segmentPhrasing}. Sur la base de ${data.review_count} essais, elle obtient un MetaCarScore de ${score}.`
        : `Sur la base de ${data.review_count} essais, l'année-modèle ${my} ${vehicleDeArticle} ${marque} ${famille} obtient un MetaCarScore de ${score}.`,
      consensusSentence,
      distributionText,
      comparisonText
    ];
    return parts.filter(Boolean).join(" ").trim().replace(/\s+/g, ' ');
  }

  // Family level
  const parts = [
    segmentPhrasing
      ? `La gamme ${marque} ${famille} ${segmentPhrasing}. Sur la base de ${data.review_count} essais cumulés, elle obtient un MetaCarScore de ${score}.`
      : `Sur la base de ${data.review_count} essais cumulés, la gamme ${marque} ${famille} obtient un MetaCarScore de ${score}.`,
    consensusSentence,
    distributionText,
    comparisonText
  ];
  return parts.filter(Boolean).join(" ").trim().replace(/\s+/g, ' ');
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
