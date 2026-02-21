import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock Supabase
const mockSelect = mock(() => ({
  eq: mock(() => ({
    eq: mock(() => ({
      eq: mock(() => ({
        eq: mock(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
  or: mock(() => Promise.resolve({ data: [], error: null })),
}));

const mockFrom = mock(() => ({
  select: mockSelect,
}));

const mockSupabase = {
  from: mockFrom,
};

mock.module("@supabase/supabase-js", () => ({
  createClient: () => mockSupabase,
}));

// Mock next/cache
mock.module("next/cache", () => ({
  unstable_cache: (fn: any) => fn, // No-op for testing logic, just call the function
}));

describe("fetchBatchFighterReviews", () => {
  let fetchBatchFighterReviews: any;

  beforeEach(async () => {
    mockSelect.mockClear();
    mockFrom.mockClear();

    // Dynamic import to ensure mocks are applied first
    const module = await import("./duels");
    fetchBatchFighterReviews = module.fetchBatchFighterReviews;
  });

  it("should fetch reviews for multiple slugs in a single query", async () => {
    // Setup mock return data
    const mockData = [
      { Marque: "Porsche", Famille: "911", MY: 2022, Modele: "GT3", Testeur: "TopGear", Score: 90 },
      { Marque: "Ferrari", Famille: "F8", MY: 2020, Modele: "Tributo", Testeur: "Evo", Score: 92 },
    ];

    // Mock the .or() chain
    mockSelect.mockImplementation(() => ({
      or: mock(() => Promise.resolve({ data: mockData, error: null })),
    }));

    const slugs = [
      "Porsche_911_2022_GT3",
      "Ferrari_F8_2020_Tributo"
    ];

    const result = await fetchBatchFighterReviews(slugs);

    // Verify Supabase was called correctly
    expect(mockFrom).toHaveBeenCalledWith("reviews");
    expect(mockSelect).toHaveBeenCalled(); // .select('*')

    // Verify result structure
    expect(result["Porsche_911_2022_GT3"]).toHaveLength(1);
    expect(result["Ferrari_F8_2020_Tributo"]).toHaveLength(1);
    expect(result["Porsche_911_2022_GT3"][0].Score).toBe(90);
  });
});
