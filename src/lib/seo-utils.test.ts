import { expect, test, describe } from "bun:test";
import { generateSeoText, SeoStats, cleanSeoText } from "./seo-utils";

const baseStats: SeoStats = {
  review_count: 19,
  metacarscore: 92,
  q1: 85,
  median: 90,
  q3: 94,
  iqr: 9,
  consensus_label: 'certaines nuances',
  distribution: {
    positive: { count: 17, percentage: 89 },
    mixed: { count: 2, percentage: 11 },
    negative: { count: 0, percentage: 0 }
  },
  rank: 12,
  total_in_segment: 88,
  segment_avg: 81.6,
  segments: [{ macro: "Sport / Coupé / Cab", size: "GT" }],
  is_reliable: true
};

describe("generateSeoText", () => {
  test("Porsche 911 GT3 (Feminine, Grand Tourisme)", () => {
    const text = generateSeoText(baseStats, {
      marque: "Porsche",
      famille: "911",
      modele: "911 GT3",
      level: "modele"
    });

    expect(text).toContain("La Porsche 911 GT3 appartient au segment [[segment:Sport / Coupé / Cab:GT|Grand Tourisme]].");
    expect(text).toContain("elle obtient un MetaCarScore de 92.");
    expect(text).toContain("divergences d’appréciation");
    expect(text).toContain("Elle se classe actuellement 12e/88");
  });

  test("SUV (Masculine)", () => {
    const suvStats = {
      ...baseStats,
      segments: [{ macro: "SUV / Crossover", size: "C" }]
    };
    const text = generateSeoText(suvStats, {
      marque: "Peugeot",
      famille: "3008",
      modele: "3008",
      level: "modele"
    });

    expect(text).toContain("Le Peugeot 3008 appartient au segment des [[segment:SUV / Crossover:C|SUV Compacts]].");
    expect(text).toContain("il obtient un MetaCarScore de 92.");
    expect(text).toContain("Il se classe actuellement 12e/88");
  });

  test("Utility (Masculine, special phrasing)", () => {
    const utilityStats = {
      ...baseStats,
      segments: [{ macro: "Utilitaire / Pickup", size: "D" }]
    };
    const text = generateSeoText(utilityStats, {
      marque: "Ford",
      famille: "Ranger",
      modele: "Ranger",
      level: "modele"
    });

    expect(text).toContain("Le Ford Ranger appartient au segment des utilitaires / pickups [[segment:Utilitaire / Pickup:D|Moyen / 1 Tonne]].");
  });

  test("MY Level (Feminine context for 'année-modèle')", () => {
    const text = generateSeoText(baseStats, {
      marque: "Porsche",
      famille: "911",
      my: "2025",
      level: "my"
    });

    expect(text).toContain("L'année-modèle 2025 de la Porsche 911 couvre le segment [[segment:Sport / Coupé / Cab:GT|Grand Tourisme]].");
    expect(text).toContain("Sur la base de 19 essais, elle obtient");
    expect(text).toContain("autour de cette année-modèle");
    expect(text).toContain("Elle se classe actuellement");
  });

  test("Family Level (Feminine context for 'gamme')", () => {
    const text = generateSeoText(baseStats, {
      marque: "Porsche",
      famille: "911",
      level: "family"
    });

    expect(text).toContain("La gamme Porsche 911 couvre le segment [[segment:Sport / Coupé / Cab:GT|Grand Tourisme]].");
    expect(text).toContain("Sur la base de 19 essais cumulés, elle obtient");
    expect(text).toContain("autour de cette gamme");
  });

  test("Consensus phrasing", () => {
    const consensusStats = {
      ...baseStats,
      consensus_label: 'consensus',
      distribution: { ...baseStats.distribution, positive: { count: 10, percentage: 50 } }
    };
    const text = generateSeoText(consensusStats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("La presse affiche un [[iqr:consensus|large consensus]] autour de ce véhicule.");
  });

  test("Division phrasing", () => {
    const divisionStats = {
      ...baseStats,
      consensus_label: 'division',
      distribution: { ...baseStats.distribution, positive: { count: 10, percentage: 50 } }
    };
    const text = generateSeoText(divisionStats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("La presse est [[iqr:division|fortement divisée]] au sujet de ce véhicule.");
  });

  test("Fallback when segment is missing", () => {
    const noSegmentStats = { ...baseStats, segments: [] };
    const text = generateSeoText(noSegmentStats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    // On ne vérifie plus "not.toContain('segment')" car la comparaison l'utilise
    expect(text).toContain("Sur la base de 19 essais, Le X Z obtient un MetaCarScore de 92.");
    expect(text).toContain("moyenne du segment");
  });

  test("Multi-segments phrasing", () => {
    const multiStats = {
      ...baseStats,
      segments: [
        { macro: "SUV / Crossover", size: "C" },
        { macro: "Berline / Hatch", size: "C" }
      ]
    };
    const text = generateSeoText(multiStats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("couvre les segments [[segment:SUV / Crossover:C|SUV Compacts]] et [[segment:Berline / Hatch:C|Compactes]].");
  });

  test("Strong positive majority with division (Case A)", () => {
    const stats: SeoStats = {
      ...baseStats,
      consensus_label: 'division',
      distribution: {
        positive: { count: 80, percentage: 80 },
        mixed: { count: 10, percentage: 10 },
        negative: { count: 10, percentage: 10 }
      }
    };
    const text = generateSeoText(stats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("La presse se montre très favorable dans l’ensemble (80 % d’avis positifs), même si les [[iqr:division|appréciations restent contrastées]].");
    expect(text).not.toContain("Les avis sont majoritairement");
  });

  test("Strong negative majority with division (Case B)", () => {
    const stats: SeoStats = {
      ...baseStats,
      consensus_label: 'division',
      distribution: {
        positive: { count: 10, percentage: 10 },
        mixed: { count: 10, percentage: 10 },
        negative: { count: 80, percentage: 80 }
      }
    };
    const text = generateSeoText(stats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("La presse se montre très critique dans l’ensemble (80 % d’avis négatifs), même si les [[iqr:division|appréciations restent contrastées]].");
    expect(text).not.toContain("Les avis sont majoritairement");
  });

  test("Strong positive majority with consensus (Case D)", () => {
    const stats: SeoStats = {
      ...baseStats,
      consensus_label: 'consensus',
      distribution: {
        positive: { count: 90, percentage: 90 },
        mixed: { count: 10, percentage: 10 },
        negative: { count: 0, percentage: 0 }
      }
    };
    const text = generateSeoText(stats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("La presse se montre [[iqr:consensus|unanimement favorable]], avec 90 % d’avis positifs.");
    expect(text).not.toContain("Les avis sont majoritairement");
  });

  test("Strong negative majority with consensus (Case E)", () => {
    const stats: SeoStats = {
      ...baseStats,
      consensus_label: 'consensus',
      distribution: {
        positive: { count: 0, percentage: 0 },
        mixed: { count: 10, percentage: 10 },
        negative: { count: 90, percentage: 90 }
      }
    };
    const text = generateSeoText(stats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("La presse se montre [[iqr:consensus|unanimement critique]], avec 90 % d’avis négatifs.");
    expect(text).not.toContain("Les avis sont majoritairement");
  });

  test("Plural segments comparison", () => {
    const stats: SeoStats = {
      ...baseStats,
      segments: [
        { macro: "SUV / Crossover", size: "C" },
        { macro: "Berline / Hatch", size: "C" }
      ]
    };
    const text = generateSeoText(stats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("se classe actuellement 12e/88 de ses catégories, au-dessus de la moyenne des segments qui est de 82.");
  });
});

describe("cleanSeoText", () => {
  test("removes iqr markers", () => {
    const input = "La presse affiche un [[iqr:consensus|large consensus]] autour de ce véhicule.";
    expect(cleanSeoText(input)).toBe("La presse affiche un large consensus autour de ce véhicule.");
  });

  test("removes multiple markers", () => {
    const input = "[[iqr:nuance|Quelques nuances]] malgré un [[iqr:consensus|large consensus]].";
    expect(cleanSeoText(input)).toBe("Quelques nuances malgré un large consensus.");
  });

  test("removes custom markers", () => {
    const input = "Texte avec [[custom:type|label personnalisé]].";
    expect(cleanSeoText(input)).toBe("Texte avec label personnalisé.");
  });

  test("handles empty string", () => {
    expect(cleanSeoText("")).toBe("");
  });

  test("handles string without markers", () => {
    const input = "Texte normal sans balises.";
    expect(cleanSeoText(input)).toBe(input);
  });
});
