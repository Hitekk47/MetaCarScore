import { describe, it, expect, mock, beforeAll } from "bun:test";

describe("utils", () => {
  let utils: any;

  beforeAll(async () => {
    // Mocking dependencies that might be problematic in the environment
    mock.module("clsx", () => ({
      clsx: (...args: any[]) => args.join(" "),
      default: (...args: any[]) => args.join(" "),
    }));
    mock.module("tailwind-merge", () => ({
      twMerge: (arg: any) => arg,
    }));

    // Dynamically import the module under test AFTER mocking
    utils = await import("./utils");
  });

  describe("groupBy", () => {
    it("should group items by key", () => {
      const list = [
        { id: 1, category: "A" },
        { id: 2, category: "B" },
        { id: 3, category: "A" },
      ];
      const result = utils.groupBy(list, (item: any) => item.category);
      expect(result).toEqual({
        A: [
          { id: 1, category: "A" },
          { id: 3, category: "A" },
        ],
        B: [{ id: 2, category: "B" }],
      });
    });

    it("should work with numeric keys", () => {
      const list = [
        { id: 1, year: 2020 },
        { id: 2, year: 2021 },
        { id: 3, year: 2020 },
      ];
      const result = utils.groupBy(list, (item: any) => item.year);
      expect(result).toEqual({
        2020: [
          { id: 1, year: 2020 },
          { id: 3, year: 2020 },
        ],
        2021: [{ id: 2, year: 2021 }],
      });
    });
  });

  describe("serializeJsonLd", () => {
    it("should serialize object to JSON and escape <", () => {
      const data = { name: "Test", script: "<script>" };
      const result = utils.serializeJsonLd(data);
      expect(result).toContain("Test");
      // JSON.stringify will escape the backslash in the replacement string if it was "\\u003c"
      // But serializeJsonLd uses .replace(/</g, '\\u003c')
      // Wait, let's check what it actually produces
      expect(result).toContain("\\u003cscript>");

      const parsed = JSON.parse(result.replace(/\\u003c/g, '<'));
      expect(parsed).toEqual(data);
    });
  });
});
