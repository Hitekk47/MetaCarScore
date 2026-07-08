import { describe, it, expect, mock } from "bun:test";

mock.module("clsx", () => ({
  clsx: (...args: any[]) => args.join(" "),
  default: (...args: any[]) => args.join(" "),
}));

mock.module("tailwind-merge", () => ({
  twMerge: (arg: any) => arg,
}));

describe("serializeJsonLd", () => {
  it("should escape < to prevent closing script tags", async () => {
    const { serializeJsonLd } = await import("./utils");
    const data = { name: "</script><script>alert(1)</script>" };
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
  });

  it("should escape > to prevent potential issues in some parsers", async () => {
    const { serializeJsonLd } = await import("./utils");
    const data = { name: "test >" };
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain(">");
    expect(serialized).toContain("\\u003e");
  });

  it("should escape & to prevent HTML entity confusion", async () => {
    const { serializeJsonLd } = await import("./utils");
    const data = { name: "test &" };
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("&");
    expect(serialized).toContain("\\u0026");
  });

  it("should escape unicode line terminators to prevent JS parsing errors", async () => {
    const { serializeJsonLd } = await import("./utils");
    const data = {
        lineSeparator: "\u2028",
        paragraphSeparator: "\u2029"
    };
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("\u2028");
    expect(serialized).not.toContain("\u2029");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
  });
});
