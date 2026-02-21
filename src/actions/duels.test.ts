import { describe, it, expect, mock, beforeEach } from "bun:test";

// Shared mocks
const mockOr = mock(() => Promise.resolve({ data: [], error: null }));

// Mock chain for fetchFighterReviews (.eq chain)
const mockEq4 = mock(() => Promise.resolve({ data: [], error: null }));
const mockEq3 = mock(() => ({ eq: mockEq4 }));
const mockEq2 = mock(() => ({ eq: mockEq3 }));
const mockEq1 = mock(() => ({ eq: mockEq2 }));

const mockSelectResult = {
  eq: mockEq1,
  or: mockOr,
};

const mockSelect = mock(() => mockSelectResult);

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
  unstable_cache: (fn: any) => fn,
}));

describe("fetchFighterReviews & fetchBatchFighterReviews", () => {
  let fetchFighterReviews: any;
  let fetchBatchFighterReviews: any;

  beforeEach(async () => {
    // Clear mocks
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockOr.mockClear();
    mockEq1.mockClear();

    // Re-import to ensure fresh module
    const module = await import("./duels");
    fetchFighterReviews = module.fetchFighterReviews;
    fetchBatchFighterReviews = module.fetchBatchFighterReviews;
  });

  // --- Original Tests ---
  it("should fetch reviews for multiple slugs in a single query", async () => {
    // Setup mock return data
    const mockData = [
      { Marque: "Porsche", Famille: "911", MY: 2022, Modele: "GT3", Testeur: "TopGear", Score: 90 },
      { Marque: "Ferrari", Famille: "F8", MY: 2020, Modele: "Tributo", Testeur: "Evo", Score: 92 },
    ];

    // Mock the .or() chain
    mockOr.mockResolvedValueOnce({ data: mockData, error: null });

    const slugs = [
      "Porsche_911_2022_GT3",
      "Ferrari_F8_2020_Tributo"
    ];

    const result = await fetchBatchFighterReviews(slugs);

    // Verify Supabase was called correctly
    expect(mockFrom).toHaveBeenCalledWith("reviews");
    expect(mockSelect).toHaveBeenCalled(); // .select('*')
    expect(mockOr).toHaveBeenCalled();

    // Verify result structure
    expect(result["Porsche_911_2022_GT3"]).toHaveLength(1);
    expect(result["Ferrari_F8_2020_Tributo"]).toHaveLength(1);
    expect(result["Porsche_911_2022_GT3"][0].Score).toBe(90);
  });

  // --- Security Tests ---
  it("should not execute query if marque contains invalid characters in fetchFighterReviews", async () => {
    const slug = 'marque"_famille_2020_model';
    const result = await fetchFighterReviews(slug);

    expect(result).toEqual([]);
    // Should NOT call supabase if validation is working
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should not include invalid slug in batch query in fetchBatchFighterReviews", async () => {
    const slug = 'marque"_famille_2020_model';
    const slugs = [slug];

    const result = await fetchBatchFighterReviews(slugs);

    expect(result).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should filter out invalid slugs but process valid ones in batch query", async () => {
    const badSlug = 'bad"_famille_2020_model';
    const goodSlug = 'good_famille_2020_model';

    // Setup mock return for valid query
    mockOr.mockResolvedValueOnce({
        data: [{ Marque: "good", Famille: "famille", MY: 2020, Modele: "model" }],
        error: null
    });

    const result = await fetchBatchFighterReviews([badSlug, goodSlug]);

    // Should call supabase
    expect(mockFrom).toHaveBeenCalledWith('reviews');

    // Check argument to .or()
    expect(mockOr).toHaveBeenCalled();
    const query = mockOr.mock.calls[0][0];

    // Query should contain good slug parts
    expect(query).toContain('good');
    // Query should NOT contain bad slug parts
    expect(query).not.toContain('bad"');

    // Result should contain good slug data
    expect(result['good_famille_2020_model']).toBeDefined();
    // Result should return empty array for bad slug
    expect(result['bad"_famille_2020_model']).toEqual([]);
  });
});
