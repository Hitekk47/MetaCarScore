import { describe, it, expect } from "bun:test";
import { normalizeSourceName, magazineCountries } from "./magazines";

describe("normalizeSourceName", () => {
  it("should lowercase the name", () => {
    expect(normalizeSourceName("Auto Bild")).toBe("auto bild");
  });

  it("should trim whitespace", () => {
    expect(normalizeSourceName("  Top Gear  ")).toBe("top gear");
  });

  it("should strip invisible characters like soft hyphens", () => {
    // \u00AD is soft hyphen
    expect(normalizeSourceName("AUTO\u00ADStraßen\u00ADverkehr")).toBe("autostraßenverkehr");
  });

  it("should strip zero-width spaces", () => {
    // \u200B is zero-width space
    expect(normalizeSourceName("EVO\u200B")).toBe("evo");
  });

  it("should handle empty or null input", () => {
    expect(normalizeSourceName("")).toBe("");
    // @ts-ignore
    expect(normalizeSourceName(null)).toBe("");
  });
});

describe("magazineCountries lookup", () => {
  it("should find the flag for normalized names", () => {
    const source = "L'Automobile Magazine";
    const normalized = normalizeSourceName(source);
    expect(magazineCountries[normalized]).toBe("🇫🇷");
  });

  it("should find the flag for names with special characters after normalization", () => {
    const source = "AUTO\u00ADStraßen\u00ADverkehr";
    const normalized = normalizeSourceName(source);
    expect(magazineCountries[normalized]).toBe("🇩🇪");
  });

  it("should find the flag for names with typos if mapped", () => {
    const source = "Quattrouote";
    const normalized = normalizeSourceName(source);
    expect(magazineCountries[normalized]).toBe("🇮🇹");
  });
});
