import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock next/cache
mock.module("next/cache", () => ({
  unstable_cache: <T>(fn: T): T => fn,
}));

// Mock @/lib/queries
const mockGetFullContext = mock();
const mockGetReviews = mock();
mock.module("@/lib/queries", () => ({
  getFullContext: mockGetFullContext,
  getReviews: mockGetReviews,
}));

// Mock @/lib/supabase
const mockOr = mock(() => Promise.resolve({ data: [], error: null }));
const mockSelect = mock(() => ({ or: mockOr }));
const mockFrom = mock(() => ({ select: mockSelect }));

mock.module("@/lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Define the test
describe("fetchBatchFighterReviews security", () => {
  beforeEach(() => {
    mockGetFullContext.mockClear();
    mockGetReviews.mockClear();
    mockOr.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  it("should call getReviews with resolved context parameters to fetch consolidated reviews", async () => {
    // Import the action AFTER mocking
    const { fetchBatchFighterReviews } = await import("./duels");

    mockGetFullContext.mockImplementation(async ({ p_marque_slug }: { p_marque_slug?: string }) => {
      if (p_marque_slug === "ebro") {
        return {
          real_marque: 'Ebro',
          real_famille: 'S700',
          real_modele: 'S700',
        };
      }
      return null;
    });

    mockGetReviews.mockImplementation(async () => [
      { Score: 73, Marque: 'Ebro', Famille: 'S700', Modele: 'S700', MY: 2024 }
    ]);

    const result = await fetchBatchFighterReviews(["ebro_s700_2024_s700"]);

    expect(mockGetFullContext).toHaveBeenCalledWith({
      p_marque_slug: "ebro",
      p_famille_slug: "s700",
      p_my: 2024,
      p_modele_slug: "s700"
    });

    expect(mockGetReviews).toHaveBeenCalledWith({
      marque: 'Ebro',
      famille: 'S700',
      my: 2024,
      modele: 'S700'
    });

    expect(result["ebro_s700_2024_s700"]).toHaveLength(1);
  });
});
