import { VehicleSeoStats } from "./types";

export type SeoPageLevel = 'family' | 'my' | 'modele' | 'powertrain';

export interface SeoContext {
  marque: string;
  famille: string;
  my?: string | number;
  modele?: string;
}

export function generateSeoText(data: VehicleSeoStats, level: SeoPageLevel, context: SeoContext): string {
  // Resilience against string types from BigInt/Numeric in PostgreSQL
  const totalEssais = Number(data.total_essais);
  const metaScore = Number(data.metacarscore);
  const stdDev = Number(data.stddev);
  const posCount = Number(data.pos_count);
  const mixCount = Number(data.mix_count);
  const negCount = Number(data.neg_count);
  const avgSegmentScore = Number(data.avg_segment_score);
  const rankVal = data.rank ? Number(data.rank) : null;
  const totalInSegment = data.total_in_segment ? Number(data.total_in_segment) : null;
  const segmentsList = data.segments || [];

  if (!totalEssais || totalEssais === 0) return "";

  const name = level === 'family' ? context.famille :
               level === 'my' ? `${context.famille} (${context.my})` :
               level === 'modele' || level === 'powertrain' ? `${context.modele} (${context.my})` : context.famille;

  const marqueName = context.marque;

  // 1. Segment & Introduction
  let intro = "";
  if (level === 'modele' || level === 'powertrain') {
    const segmentStr = segmentsList.length > 0 ? segmentsList[0] : "son segment";
    intro = `Le ${marqueName} ${name} s'inscrit dans le segment des ${segmentStr}. `;
  } else {
    const segmentLabel = segmentsList.length > 1 ? "les segments" : "le segment";
    const segmentListStr = segmentsList.length > 0 ? segmentsList.join(', ') : "son segment";
    intro = `${level === 'family' ? 'La gamme' : "L'année-modèle"} ${marqueName} ${name} couvre ${segmentLabel} ${segmentListStr}. `;
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
        rankingText = `Il se classe actuellement ${position} sur ${totalInSegment} de sa catégorie, ${comparison} de la moyenne du segment qui est de ${avgSegmentScore}.`;
    } else {
        rankingText = `Il se classe globalement ${comparison} de la moyenne des segments couverts qui est de ${avgSegmentScore}.`;
    }
  }

  return `${intro}${scoreText}${consensusText}${distributionText}${rankingText}`.trim();
}
