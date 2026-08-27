import { expect, test, describe, mock, beforeAll } from "bun:test";

mock.module("clsx", () => ({
  clsx: (...args: unknown[]) => args.join(" "),
  default: (...args: unknown[]) => args.join(" "),
}));

mock.module("tailwind-merge", () => ({
  twMerge: (arg: string) => arg,
}));

describe("utils", () => {
  let utils: typeof import("./utils");

  beforeAll(async () => {
    utils = await import("./utils");
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
  });
});
