import { expect, test, describe, mock, beforeAll } from "bun:test";

mock.module("clsx", () => ({
  clsx: (...args: any[]) => args.join(" "),
  default: (...args: any[]) => args.join(" "),
}));

mock.module("tailwind-merge", () => ({
  twMerge: (arg: string) => arg,
}));

describe("utils", () => {
  let utils: any;

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
      const result = utils.groupBy(list, (item: any) => item.name);
      expect(result).toEqual({
        Alice: [
          { id: 1, name: "Alice" },
          { id: 3, name: "Alice" },
        ],
        Bob: [{ id: 2, name: "Bob" }],
      });
    });

    test("should handle empty list", () => {
      const result = utils.groupBy([], (item: any) => item.id);
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
});
