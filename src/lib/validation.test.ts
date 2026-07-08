import { describe, it, expect } from "bun:test";
import {
  isValidSlugPart,
  isValidModelPart,
  isValidYear,
  escapePostgrestValue
} from "./validation";

describe("Validation Helpers", () => {
  describe("isValidSlugPart", () => {
    it("should return true for valid slug parts", () => {
      expect(isValidSlugPart("porsche")).toBe(true);
      expect(isValidSlugPart("911-gt3")).toBe(true);
    });

    it("should return false for invalid slug parts", () => {
      expect(isValidSlugPart("Porsche")).toBe(false); // No uppercase
      expect(isValidSlugPart("porsche_911")).toBe(false); // No underscores
      expect(isValidSlugPart("porsche/911")).toBe(false);
      expect(isValidSlugPart("porsche\"")).toBe(false);
    });
  });

  describe("isValidModelPart", () => {
    it("should return true for valid model parts", () => {
      expect(isValidModelPart("911_gt3")).toBe(true); // Underscores allowed
      expect(isValidModelPart("911-gt3")).toBe(true);
    });

    it("should return false for invalid model parts", () => {
      expect(isValidModelPart("911 GT3")).toBe(false); // No spaces
      expect(isValidModelPart("911\"")).toBe(false);
    });
  });

  describe("isValidYear", () => {
    it("should return true for valid years", () => {
      expect(isValidYear(1900)).toBe(true);
      expect(isValidYear(2023)).toBe(true);
      expect(isValidYear(2100)).toBe(true);
    });

    it("should return false for invalid years", () => {
      expect(isValidYear(1899)).toBe(false);
      expect(isValidYear(2101)).toBe(false);
      expect(isValidYear(NaN)).toBe(false);
    });
  });

  describe("escapePostgrestValue", () => {
    it("should escape double quotes", () => {
      expect(escapePostgrestValue('Brand "With" Quotes')).toBe('Brand \\"With\\" Quotes');
    });

    it("should escape backslashes", () => {
      expect(escapePostgrestValue('Brand \\ With \\ Backslash')).toBe('Brand \\\\ With \\\\ Backslash');
    });

    it("should escape both, with backslash first", () => {
      // Input: A"B\C
      // 1. Backslash: A"B\\C
      // 2. Quote: A\"B\\C
      expect(escapePostgrestValue('A"B\\C')).toBe('A\\"B\\\\C');
    });
  });
});
