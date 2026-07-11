import { VehicleSeoStats } from "./types";

export type SeoPageLevel = 'family' | 'my' | 'modele' | 'powertrain';

export interface SeoContext {
  marque: string;
  famille: string;
  my?: string | number;
  modele?: string;
}

export function generateSeoText(data: any, level: SeoPageLevel, context: SeoContext): string {
  if (!data) return "";

  // Universal property access (handles camelCase, snake_case, PascalCase)
  const getProp = (keys: string[]) => {
    for (const key of keys) {
      if (data[key] !== undefined && data[key] !== null) return data[key];
    }
    return null;
  };

  const totalEssais = Number(getProp(['total_essais', 'totalEssais', 'Total_Essais', 'total']));
  const metaScore = Number(getProp(['metacarscore', 'metaCarScore', 'MetaCarScore', 'mcs']));
  const stdDev = Number(getProp(['stddev', 'stdDev', 'StdDev', 'sd']));
  const posCount = Number(getProp(['pos_count', 'posCount', 'PosCount', 'pos']));
  const mixCount = Number(getProp(['mix_count', 'mixCount', 'MixCount', 'mix']));
  const negCount = Number(getProp(['neg_count', 'negCount', 'NegCount', 'neg']));
  const avgSegmentScore = Number(getProp(['avg_segment_score', 'avgSegmentScore', 'AvgSegmentScore', 'avg_val', 'm']));
  const rankVal = getProp(['rank', 'Rank', 'rang', 'rank_val', 'r']) !== null ? Number(getProp(['rank', 'Rank', 'rang', 'rank_val', 'r'])) : null;
  const totalInSegment = getProp(['total_in_segment', 'totalInSegment', 'TotalInSegment', 'total_val', 't']) !== null ? Number(getProp(['total_in_segment', 'totalInSegment', 'TotalInSegment', 'total_val', 't'])) : null;

  // Robust parsing for Postgres segments
  let segmentsList: string[] = [];
  const rawSegments = getProp(['segments', 'Segments']);
  if (Array.isArray(rawSegments)) {
    segmentsList = rawSegments.filter(s => typeof s === 'string');
  } else if (typeof rawSegments === 'string' && rawSegments) {
    // Handle "{val1,val2}" Postgres array format
    segmentsList = (rawSegments as string)
      .replace(/[{}]/g, '')
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }

  if (!totalEssais || totalEssais === 0) return "";

  const name = level === 'family' ? context.famille :
               level === 'my' ? `${context.famille} (${context.my})` :
               level === 'modele' || level === 'powertrain' ? `${context.modele} (${context.my})` : context.famille;

  const marqueName = context.marque;

  // 1. Segment & Introduction
  let intro = "";
  if (level === 'modele' || level === 'powertrain') {
    const segmentStr = segmentsList.length > 0 ? `du segment ${segmentsList[0]}` : "de son segment de marché";
    intro = `Le ${marqueName} ${name} s'inscrit au sein ${segmentStr}. `;
  } else {
    if (segmentsList.length > 0) {
        const segmentLabel = segmentsList.length > 1 ? "les segments" : "le segment";
        intro = `${level === 'family' ? 'La gamme' : "L'année-modèle"} ${marqueName} ${name} couvre ${segmentLabel} ${segmentsList.join(', ')}. `;
    } else {
        intro = `${level === 'family' ? 'La gamme' : "L'année-modèle"} ${marqueName} ${name} couvre son segment de marché. `;
    }
  }

  // 2. Score et essais
  let scoreText = "";
  if (totalEssais < 3) {
    scoreText = `Sur la base de ${totalEssais} essai${totalEssais > 1 ? 's' : ''}, il ne dispose pas encore d'un MetaCarScore définitif. `;
  } else {
    scoreText = `Sur la base de ${totalEssais} essais, il obtient le MetaCarScore de ${metaScore}/100. `;
  }

  // 3. Consensus / Division
  let consensusText = "";
  if (totalEssais >= 3) {
    if (stdDev < 5) {
      consensusText = `La presse affiche un franc consensus autour de ce véhicule. `;
    } else if (stdDev < 10) {
      consensusText = `On note un consensus global de la part des journalistes. `;
    } else if (stdDev < 15) {
      consensusText = `Les avis sont relativement partagés au sein de la presse. `;
    } else {
      consensusText = `On observe de fortes divisions au sein de la presse spécialisée. `;
    }
  }

  // 4. Répartition
  let distributionText = "";
  const total = posCount + mixCount + negCount;
  if (total > 0) {
    const pPos = Math.round((posCount / total) * 100);
    const pMix = Math.round((mixCount / total) * 100);
    const pNeg = Math.round((negCount / total) * 100);

    if (pPos > 50) {
        distributionText = `Les avis sont majoritairement positifs (${pPos}%). `;
    } else if (pMix > 50) {
        distributionText = `Les essais font état d'un bilan globalement mitigé (${pMix}%). `;
    } else if (pNeg > 50) {
        distributionText = `Le bilan presse est majoritairement négatif (${pNeg}%). `;
    } else if (pPos === pMix && pPos > pNeg) {
        distributionText = `Les avis sont partagés entre retours positifs et mitigés. `;
    } else {
        distributionText = `Les critiques sont réparties de manière hétérogène entre avis positifs, mitigés et négatifs. `;
    }
  }

  // 5. Classement
  let rankingText = "";
  if (rankVal && totalInSegment) {
    const position = rankVal === 1 ? "1er" : `${rankVal}ème`;
    const comparison = metaScore >= avgSegmentScore ? "au-dessus" : "en-dessous";

    if (level === 'modele' || level === 'powertrain' || (level === 'my' && segmentsList.length === 1)) {
        rankingText = `Il se classe actuellement ${position} sur ${totalInSegment} de sa catégorie, ${comparison} de la moyenne du segment qui est de ${avgSegmentScore}/100.`;
    } else {
        rankingText = `Il se classe globalement ${comparison} de la moyenne des segments couverts qui est de ${avgSegmentScore}/100.`;
    }
  } else if (totalEssais >= 3) {
    rankingText = `Il se positionne comme une alternative intéressante au sein de sa catégorie.`;
  }

  return `${intro}${scoreText}${consensusText}${distributionText}${rankingText}`.trim();
}
