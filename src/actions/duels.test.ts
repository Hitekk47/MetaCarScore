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

// Mock getFullContext from lib/queries
// Using a mock function directly imported
const mockGetFullContext = mock(async (params: any) => {
  // Simple mock logic: if slug is valid, return Real Names
  if (params.p_marque_slug === "porsche") {
    return {
      real_marque: "Porsche",
      real_famille: "911",
      real_modele: "GT3",
      real_powertrain: null
    };
  }
  if (params.p_marque_slug === "ferrari") {
    return {
      real_marque: "Ferrari",
      real_famille: "F8",
      real_modele: "Tributo",
      real_powertrain: null
    };
  }
  return null;
});

mock.module("@/lib/queries", () => ({
  getFullContext: mockGetFullContext
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
    mockGetFullContext.mockClear();

    // Re-import to ensure fresh module
    const module = await import("./duels");
    fetchFighterReviews = module.fetchFighterReviews;
    fetchBatchFighterReviews = module.fetchBatchFighterReviews;
  });

  // --- Original Tests (Updated for Slug Resolution) ---
  it("should resolve slugs and fetch reviews for multiple slugs", async () => {
    // Setup mock return data from DB (using Real Names)
    const mockData = [
      { Marque: "Porsche", Famille: "911", MY: 2022, Modele: "GT3", Testeur: "TopGear", Score: 90 },
      { Marque: "Ferrari", Famille: "F8", MY: 2020, Modele: "Tributo", Testeur: "Evo", Score: 92 },
    ];

    // Mock the .or() chain
    mockOr.mockResolvedValueOnce({ data: mockData, error: null });

    const slugs = [
      "porsche_911_2022_gt3", // slug
      "ferrari_f8_2020_tributo" // slug
    ];

    const result = await fetchBatchFighterReviews(slugs);

    // Verify getFullContext was called
    // We expect it to be called for EACH slug
    // Since we map and await Promise.all, order is not guaranteed but usually sequential in map
    // We check that it was called with correct params

    // We can't guarantee call order, so let's check if calls contain the expected arguments
    expect(mockGetFullContext).toHaveBeenCalledTimes(2);

    // We verify calls by checking mock.calls
    const calls = mockGetFullContext.mock.calls;
    const hasPorsche = calls.some((args: any) => args[0].p_marque_slug === "porsche");
    const hasFerrari = calls.some((args: any) => args[0].p_marque_slug === "ferrari");

    expect(hasPorsche).toBe(true);
    expect(hasFerrari).toBe(true);

    // Verify Supabase was called with REAL NAMES
    expect(mockFrom).toHaveBeenCalledWith("reviews");

    // Check the query string passed to .or()
    const query = mockOr.mock.calls[0][0];
    expect(query).toContain('Marque.eq."Porsche"'); // Real Name
    expect(query).not.toContain('Marque.eq."porsche"'); // Slug

    // Verify result structure (mapped back to slugs)
    expect(result["porsche_911_2022_gt3"]).toHaveLength(1);
    expect(result["ferrari_f8_2020_tributo"]).toHaveLength(1);
    expect(result["porsche_911_2022_gt3"][0].Score).toBe(90);
  });

  // --- Security Tests ---
  it("should not execute query if slug contains invalid characters", async () => {
    const slug = 'marque"_famille_2020_model';
    const result = await fetchBatchFighterReviews([slug]);

    expect(result).toEqual({});
    // Should NOT call getFullContext if validation fails early
    expect(mockGetFullContext).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should handle mixed valid and invalid slugs", async () => {
    const badSlug = 'bad"_famille_2020_model';
    const goodSlug = 'porsche_911_2022_gt3'; // Valid slug that mocks resolve

    // Mock DB return for the GOOD slug
    mockOr.mockResolvedValueOnce({
        data: [{ Marque: "Porsche", Famille: "911", MY: 2022, Modele: "GT3" }],
        error: null
    });

    const result = await fetchBatchFighterReviews([badSlug, goodSlug]);

    // Should call getFullContext ONLY for good slug
    expect(mockGetFullContext).toHaveBeenCalledTimes(1);
    const calls = mockGetFullContext.mock.calls;
    expect(calls[0][0].p_marque_slug).toBe("porsche");

    expect(mockFrom).toHaveBeenCalledWith('reviews');

    // Result should contain good slug data
    expect(result['porsche_911_2022_gt3']).toBeDefined();
    // Result should return empty array for bad slug
    expect(result['bad"_famille_2020_model']).toEqual([]); // It initializes keys for requested slugs
  });
});
