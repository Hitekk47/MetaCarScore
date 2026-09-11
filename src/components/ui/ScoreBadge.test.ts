import { describe, it, expect } from "bun:test";

describe("ScoreBadge logic", () => {
  const getIsPending = ({
    isFiltered = false,
    sourceCount,
    reviewCount,
    isReliable,
  }: {
    isFiltered?: boolean;
    sourceCount?: number;
    reviewCount?: number;
    isReliable?: boolean;
  }) => {
    return isReliable !== undefined
      ? !isReliable
      : isFiltered && reviewCount !== undefined
      ? reviewCount < 3
      : sourceCount !== undefined
      ? sourceCount < 3
      : reviewCount !== undefined && reviewCount < 3;
  };

  const getTooltipText = (isFiltered: boolean) => {
    return isFiltered ? "Min. 3 essais requis" : "Min. 3 sources requises";
  };

  it("should enforce min 3 distinct sources when not filtered", () => {
    // 2 sources, 5 reviews, not filtered => pending (insufficient sources)
    expect(getIsPending({ isFiltered: false, sourceCount: 2, reviewCount: 5 })).toBe(true);
    expect(getTooltipText(false)).toBe("Min. 3 sources requises");

    // 3 sources, 3 reviews, not filtered => reliable
    expect(getIsPending({ isFiltered: false, sourceCount: 3, reviewCount: 3 })).toBe(false);
  });

  it("should enforce min 3 reviews instead of sources when filtered", () => {
    // 2 sources, 3 reviews, filtered => reliable (reviewCount >= 3)
    expect(getIsPending({ isFiltered: true, sourceCount: 2, reviewCount: 3 })).toBe(false);

    // 5 sources, 2 reviews, filtered => pending (reviewCount < 3)
    expect(getIsPending({ isFiltered: true, sourceCount: 5, reviewCount: 2 })).toBe(true);
    expect(getTooltipText(true)).toBe("Min. 3 essais requis");
  });
});
