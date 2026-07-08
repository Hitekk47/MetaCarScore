import { describe, expect, it, mock, beforeAll } from "bun:test";

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        or: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}));

mock.module("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
}));

mock.module("react", () => ({
  cache: (fn: any) => fn,
}));

let isValidSlugPart: any;
let isValidModelPart: any;
let isValidYear: any;
let escapePostgrestValue: any;

beforeAll(async () => {
  // Use a query string to bypass cache if needed, though here it's the first import
  const mod = await import("./duels.ts");
  isValidSlugPart = mod.isValidSlugPart;
  isValidModelPart = mod.isValidModelPart;
  isValidYear = mod.isValidYear;
  escapePostgrestValue = mod.escapePostgrestValue;
});

describe("duels.ts security & validation", () => {
  describe("escapePostgrestValue", () => {
    it("should escape double quotes by doubling them", () => {
      expect(escapePostgrestValue('Car "Name"')).toBe('Car ""Name""');
    });

    it("should not escape backslashes (standard SQL in quotes)", () => {
      expect(escapePostgrestValue('Car\\Name')).toBe('Car\\Name');
    });

    it("should handle mixed special characters", () => {
      expect(escapePostgrestValue('Car "With" \\Slash\\')).toBe('Car ""With"" \\Slash\\');
    });

    it("should return same string if no special characters", () => {
      expect(escapePostgrestValue('NormalName')).toBe('NormalName');
    });
  });

  describe("isValidSlugPart", () => {
    it("should allow lowercase alphanumeric and hyphens", () => {
      expect(isValidSlugPart("bmw")).toBe(true);
      expect(isValidSlugPart("series-3")).toBe(true);
      expect(isValidSlugPart("3-series")).toBe(true);
    });

    it("should disallow uppercase", () => {
      expect(isValidSlugPart("BMW")).toBe(false);
    });

    it("should disallow underscores", () => {
      expect(isValidSlugPart("bmw_m3")).toBe(false);
    });

    it("should disallow special characters", () => {
      expect(isValidSlugPart("bmw'")).toBe(false);
      expect(isValidSlugPart("bmw\"")).toBe(false);
      expect(isValidSlugPart("bmw;")).toBe(false);
    });
  });

  describe("isValidModelPart", () => {
    it("should allow underscores", () => {
      expect(isValidModelPart("m3_competition")).toBe(true);
    });

    it("should allow hyphens", () => {
      expect(isValidModelPart("m3-competition")).toBe(true);
    });

    it("should disallow quotes", () => {
      expect(isValidModelPart("m3\"")).toBe(false);
      expect(isValidModelPart("m3'")).toBe(false);
    });
  });

  describe("isValidYear", () => {
    it("should allow years between 1900 and 2100", () => {
      expect(isValidYear(1900)).toBe(true);
      expect(isValidYear(2024)).toBe(true);
      expect(isValidYear(2100)).toBe(true);
    });

    it("should disallow years outside range", () => {
      expect(isValidYear(1899)).toBe(false);
      expect(isValidYear(2101)).toBe(false);
    });

    it("should handle NaN", () => {
      expect(isValidYear(NaN)).toBe(false);
    });
  });
});
