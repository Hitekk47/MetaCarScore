import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock next/cache
mock.module("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
}));

// Mock @/lib/queries
const mockGetFullContext = mock();
mock.module("@/lib/queries", () => ({
  getFullContext: mockGetFullContext,
}));

// Mock supabase
const mockOr = mock(() => Promise.resolve({ data: [], error: null }));
const mockSelect = mock(() => ({ or: mockOr }));
const mockFrom = mock(() => ({ select: mockSelect }));

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// Define the test
describe("fetchBatchFighterReviews security", () => {
  beforeEach(() => {
    mockGetFullContext.mockClear();
    mockOr.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  it("should escape double quotes in car names to prevent PostgREST injection", async () => {
    // Import the action AFTER mocking
    const { fetchBatchFighterReviews } = await import("./duels");

    // Setup mock return for getFullContext with a malicious/special name
    mockGetFullContext.mockImplementation(async ({ p_marque_slug }: any) => {
      if (p_marque_slug === "brand") {
        return {
          real_marque: 'Brand "With" Quotes',
          real_famille: 'Family',
          real_modele: 'Model',
        };
      }
      return null;
    });

    // Call the action
    await fetchBatchFighterReviews(["brand_family_2023_model"]);

    // Verify getFullContext was called
    expect(mockGetFullContext).toHaveBeenCalled();

    // Verify the .or() call received escaped strings
    expect(mockOr).toHaveBeenCalled();
    const orQuery = mockOr.mock.calls[0][0] as string;

    // The expected PostgREST syntax for escaping " is ""
    // and(Marque.eq."Brand ""With"" Quotes",Famille.eq."Family",MY.eq.2023,Modele.eq."Model")
    expect(orQuery).toContain('Marque.eq."Brand ""With"" Quotes"');
  });
});
