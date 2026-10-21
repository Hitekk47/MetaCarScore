import { expect, test, describe, beforeAll } from "bun:test";
import type { Review } from './types';

describe("utils", () => {
  let utils: typeof import("./utils");

  beforeAll(async () => {
    utils = await import("./utils");
  });

  describe("getDistinctSourceCount", () => {
    test("should count distinct trimmed and lowercased testers", () => {
      const reviews = [
        { Testeur: "TopGear " } as Review,
        { Testeur: "topgear" } as Review,
        { Testeur: "AutoExpress" } as Review,
        { Testeur: "  AutoExpress  " } as Review,
        { Testeur: " L'Argus " } as Review,
      ];
      expect(utils.getDistinctSourceCount(reviews)).toBe(3);
    });

    test("should return 0 for empty reviews", () => {
      expect(utils.getDistinctSourceCount([])).toBe(0);
    });

    test('does not reach three sources through case variants or blank names', () => {
      const reviews = ['TopGear', 'topgear', ' TOPGEAR ', '', ' \t\n ', '\u00a0']
        .map(Testeur => ({ Testeur }) as Review);
      expect(utils.getDistinctSourceCount(reviews)).toBe(1);
    });
  });

  describe('aggregateReviews', () => {
    test('matches media by identity while retaining every review in score calculations', () => {
      const reviews = [
        { Testeur: ' TopGear ', Score: 80 },
        { Testeur: 'topgear', Score: 60 },
        { Testeur: 'TOPGEAR', Score: 40 },
        { Testeur: 'AutoExpress', Score: 100 },
        { Testeur: '   ', Score: 20 },
      ] as Review[];
      const aggregated = utils.aggregateReviews(reviews);
      expect(Object.keys(aggregated)).toEqual(['topgear', 'autoexpress']);
      expect(aggregated.topgear).toEqual({
        sourceName: 'TopGear', avgScore: 60, count: 3, rawScores: [80, 60, 40],
      });
      expect(utils.getDistinctSourceCount(reviews)).toBe(2);
      expect(utils.calculatePageStats(reviews).scores).toHaveLength(5);
      expect(utils.calculatePageStats(reviews).avgScore).toBe(60);
    });
  });

  describe("groupBy", () => {
    test("should group items by key", () => {
      const list = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Alice" },
      ];
      const result = utils.groupBy(list, (item: { id: number; name: string }) => item.name);
      expect(result).toEqual({
        Alice: [
          { id: 1, name: "Alice" },
          { id: 3, name: "Alice" },
        ],
        Bob: [{ id: 2, name: "Bob" }],
      });
    });

    test("should handle empty list", () => {
      const result = utils.groupBy([], (item: { id: number }) => item.id);
      expect(result).toEqual({});
    });
  });

  describe("serializeJsonLd", () => {
    test("should serialize object and escape < and >", () => {
      const data = { name: "Test <script>" };
      const result = utils.serializeJsonLd(data);
      expect(result).toBe('{"name":"Test \\u003cscript\\u003e"}');
    });
  });

  describe("formatAliasDisplay", () => {
    test("should return null when aliases is empty", () => {
      expect(utils.formatAliasDisplay([], "Chery")).toBeNull();
    });

    test("should format singular alias with different brand", () => {
      const aliases = [
        {
          canonical_marque: "Chery",
          canonical_famille: "Tiggo 7",
          canonical_modele: null,
          alias_marque: "Ebro",
          alias_famille: "S700",
          alias_modele: null,
        },
      ];
      expect(utils.formatAliasDisplay(aliases, "Chery")).toBe(
        "Également commercialisé sous le nom : Ebro S700"
      );
    });

    test("should format singular alias when viewing from alias brand side", () => {
      const aliases = [
        {
          canonical_marque: "Chery",
          canonical_famille: "Tiggo 7",
          canonical_modele: null,
          alias_marque: "Ebro",
          alias_famille: "S700",
          alias_modele: null,
        },
      ];
      expect(utils.formatAliasDisplay(aliases, "Ebro")).toBe(
        "Également commercialisé sous le nom : Chery Tiggo 7"
      );
    });

    test("should omit brand when alias brand matches current brand", () => {
      const aliases = [
        {
          canonical_marque: "GWM",
          canonical_famille: "Ora 03",
          canonical_modele: null,
          alias_marque: "GWM",
          alias_famille: "Ora Funky Cat",
          alias_modele: null,
        },
      ];
      expect(utils.formatAliasDisplay(aliases, "GWM")).toBe(
        "Également commercialisé sous le nom : Ora Funky Cat"
      );
    });

    test("should format plural aliases", () => {
      const aliases = [
        {
          canonical_marque: "BrandA",
          canonical_famille: "FamA",
          canonical_modele: null,
          alias_marque: "BrandB",
          alias_famille: "ModelB",
          alias_modele: null,
        },
        {
          canonical_marque: "BrandA",
          canonical_famille: "FamA",
          canonical_modele: null,
          alias_marque: "BrandC",
          alias_famille: "ModelC",
          alias_modele: null,
        },
      ];
      expect(utils.formatAliasDisplay(aliases, "BrandA")).toBe(
        "Également commercialisé sous les noms : BrandB ModelB, BrandC ModelC"
      );
    });

    test("should handle intra-brand alias rebadging (e.g., Jaecoo J7 vs Jaecoo 7)", () => {
      const aliases = [
        {
          canonical_marque: "Jaecoo",
          canonical_famille: "7",
          canonical_modele: null,
          alias_marque: "Jaecoo",
          alias_famille: "J7",
          alias_modele: null,
        },
      ];

      // Sur la page de l'alias (/jaecoo/j7) -> affiche la contrepartie canonique "7"
      expect(utils.formatAliasDisplay(aliases, "Jaecoo", "J7")).toBe(
        "Également commercialisé sous le nom : 7"
      );

      // Sur la page canonique (/jaecoo/7) -> affiche la contrepartie alias "J7"
      expect(utils.formatAliasDisplay(aliases, "Jaecoo", "7")).toBe(
        "Également commercialisé sous le nom : J7"
      );
    });
  });
});
