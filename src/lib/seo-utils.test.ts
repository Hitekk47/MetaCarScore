import { expect, test, describe } from "bun:test";
import { generateSeoText, SeoStats } from "./seo-utils";

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

    expect(text).toContain("La Porsche 911 GT3 appartient à la catégorie Grand Tourisme.");
    expect(text).toContain("elle obtient le MetaCarScore de 92.");
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

    expect(text).toContain("Le Peugeot 3008 s'inscrit dans le segment des SUV Compacts.");
    expect(text).toContain("il obtient le MetaCarScore de 92.");
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

    expect(text).toContain("Le Ford Ranger appartient à la catégorie des utilitaires / pickups Moyen / 1 Tonne.");
  });

  test("MY Level (Feminine context for 'année-modèle')", () => {
    const text = generateSeoText(baseStats, {
      marque: "Porsche",
      famille: "911",
      my: "2025",
      level: "my"
    });

    expect(text).toContain("L'année-modèle 2025 de la Porsche 911 couvre le segment Grand Tourisme.");
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

    expect(text).toContain("La gamme Porsche 911 couvre le segment Grand Tourisme.");
    expect(text).toContain("Sur la base de 19 essais cumulés, elle obtient");
    expect(text).toContain("autour de cette gamme");
  });

  test("Consensus phrasing", () => {
    const consensusStats = { ...baseStats, consensus_label: 'consensus' };
    const text = generateSeoText(consensusStats, {
      marque: "X", famille: "Y", modele: "Z", level: "modele"
    });
    expect(text).toContain("La presse affiche un [[iqr:consensus|large consensus]] autour de ce véhicule.");
  });

  test("Division phrasing", () => {
    const divisionStats = { ...baseStats, consensus_label: 'division' };
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
    expect(text).not.toContain("segment");
    expect(text).toContain("Sur la base de 19 essais, Le X Z obtient le MetaCarScore de 92.");
    expect(text).toContain("moyenne de la catégorie");
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
    expect(text).toContain("couvre les segments SUV Compacts et Compactes.");
  });
});
