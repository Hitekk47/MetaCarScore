import { VehicleSeoStats } from "./types";

export type SeoPageLevel = 'family' | 'my' | 'modele' | 'powertrain';

export interface SeoContext {
  marque: string;
  famille: string;
  my?: string | number;
  modele?: string;
}

export function generateSeoText(data: VehicleSeoStats, level: SeoPageLevel, context: SeoContext): string {
  const {
    total_essais,
    metacarscore,
    stddev,
    pos_count,
    mix_count,
    neg_count,
    segments,
    avg_segment_score,
    rank,
    total_in_segment
  } = data;

  if (total_essais === 0) return "";

  const name = level === 'family' ? context.famille :
               level === 'my' ? `${context.famille} (${context.my})` :
               level === 'modele' || level === 'powertrain' ? `${context.modele} (${context.my})` : context.famille;

  const marqueName = context.marque;

  // 1. Segment & Introduction
  let intro = "";
  if (level === 'modele' || level === 'powertrain') {
    const segmentStr = segments.length > 0 ? segments[0] : "son segment";
    intro = `Le ${marqueName} ${name} s'inscrit dans le segment des ${segmentStr}. `;
  } else {
    const segmentLabel = segments.length > 1 ? "les segments" : "le segment";
    const segmentList = segments.length > 0 ? segments.join(', ') : "son segment";
    intro = `${level === 'family' ? 'La gamme' : "L'année-modèle"} ${marqueName} ${name} couvre ${segmentLabel} ${segmentList}. `;
  }

  // 2. Score et essais
  let scoreText = "";
  if (total_essais < 3) {
    scoreText = `Sur la base de ${total_essais} essai${total_essais > 1 ? 's' : ''}, il ne dispose pas encore d'un MetaCarScore définitif. `;
  } else {
    scoreText = `Sur la base de ${total_essais} essais, il obtient le MetaCarScore de ${metacarscore}/100. `;
  }

  // 3. Consensus / Division
  let consensusText = "";
  if (total_essais >= 3) {
    if (stddev < 5) {
      consensusText = `La presse affiche un franc consensus autour de ce véhicule. `;
    } else if (stddev < 10) {
      consensusText = `On note un consensus global de la part des journalistes. `;
    } else if (stddev < 15) {
      consensusText = `Les avis sont relativement partagés au sein de la presse. `;
    } else {
      consensusText = `On observe de fortes divisions au sein de la presse spécialisée. `;
    }
  }

  // 4. Répartition
  let distributionText = "";
  const total = pos_count + mix_count + neg_count;
  if (total > 0) {
    const pPos = Math.round((pos_count / total) * 100);
    const pMix = Math.round((mix_count / total) * 100);
    const pNeg = Math.round((neg_count / total) * 100);

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
  if (rank && total_in_segment) {
    const position = rank === 1 ? "1er" : `${rank}ème`;
    const comparison = metacarscore >= avg_segment_score ? "au-dessus" : "en-dessous";

    if (level === 'modele' || level === 'powertrain' || (level === 'my' && segments.length === 1)) {
        rankingText = `Il se classe actuellement ${position} sur ${total_in_segment} de sa catégorie, ${comparison} de la moyenne du segment qui est de ${avg_segment_score}.`;
    } else {
        rankingText = `Il se classe globalement ${comparison} de la moyenne des segments couverts qui est de ${avg_segment_score}.`;
    }
  }

  return `${intro}${scoreText}${consensusText}${distributionText}${rankingText}`.trim();
}
