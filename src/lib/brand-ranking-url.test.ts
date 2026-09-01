import { describe, test, expect } from "bun:test";
import { toSlug } from "@/lib/slugify";
import { BrandRankingItem } from "@/lib/types";

function getModelUrls(item: BrandRankingItem) {
  const bestMarque = item.best_canonical_marque || item.brand;
  const bestFamille = item.best_canonical_famille || item.best_famille;
  const bestModele = item.best_canonical_modele || item.best_model;

  const worstMarque = item.worst_canonical_marque || item.brand;
  const worstFamille = item.worst_canonical_famille || item.worst_famille;
  const worstModele = item.worst_canonical_modele || item.worst_model;

  const bestModelUrl = item.best_model && bestFamille && item.best_my && bestModele
      ? `/${toSlug(bestMarque)}/${toSlug(bestFamille)}/${item.best_my}/${toSlug(bestModele)}`
      : null;
  const worstModelUrl = item.worst_model && worstFamille && item.worst_my && worstModele
      ? `/${toSlug(worstMarque)}/${toSlug(worstFamille)}/${item.worst_my}/${toSlug(worstModele)}`
      : null;

  return { bestModelUrl, worstModelUrl };
}

describe("Brand Ranking Canonical URL Resolution", () => {
  test("generates canonical URL for alias brand (e.g. Ebro S700 -> Chery Tiggo 7)", () => {
    const ebroItem: BrandRankingItem = {
      brand: "Ebro",
      avg_score: 73,
      review_count: 8,
      best_model: "S700",
      best_score: 73,
      best_famille: "Tiggo 7",
      best_my: 2024,
      best_canonical_marque: "Chery",
      best_canonical_famille: "Tiggo 7",
      best_canonical_modele: "Tiggo 7",
      worst_model: "S700",
      worst_score: 73,
      worst_famille: "Tiggo 7",
      worst_my: 2024,
      worst_canonical_marque: "Chery",
      worst_canonical_famille: "Tiggo 7",
      worst_canonical_modele: "Tiggo 7",
    };

    const { bestModelUrl, worstModelUrl } = getModelUrls(ebroItem);

    expect(bestModelUrl).toBe("/chery/tiggo-7/2024/tiggo-7");
    expect(worstModelUrl).toBe("/chery/tiggo-7/2024/tiggo-7");
  });

  test("generates canonical URL for canonical brand (e.g. Chery Tiggo 7)", () => {
    const cheryItem: BrandRankingItem = {
      brand: "Chery",
      avg_score: 73,
      review_count: 8,
      best_model: "Tiggo 7",
      best_score: 73,
      best_famille: "Tiggo 7",
      best_my: 2024,
      best_canonical_marque: "Chery",
      best_canonical_famille: "Tiggo 7",
      best_canonical_modele: "Tiggo 7",
      worst_model: null,
      worst_score: null,
      worst_famille: null,
      worst_my: null,
    };

    const { bestModelUrl, worstModelUrl } = getModelUrls(cheryItem);

    expect(bestModelUrl).toBe("/chery/tiggo-7/2024/tiggo-7");
    expect(worstModelUrl).toBeNull();
  });

  test("falls back to item properties when canonical fields are not set", () => {
    const standaloneItem: BrandRankingItem = {
      brand: "Renault",
      avg_score: 82,
      review_count: 15,
      best_model: "Clio",
      best_score: 85,
      best_famille: "Clio",
      best_my: 2023,
      worst_model: "Twingo",
      worst_score: 68,
      worst_famille: "Twingo",
      worst_my: 2020,
    };

    const { bestModelUrl, worstModelUrl } = getModelUrls(standaloneItem);

    expect(bestModelUrl).toBe("/renault/clio/2023/clio");
    expect(worstModelUrl).toBe("/renault/twingo/2020/twingo");
  });
});
