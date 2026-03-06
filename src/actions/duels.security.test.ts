import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

// Mock Supabase
const mockEq = mock(() => ({ eq: mockEq }));
const mockOr = mock(() => Promise.resolve({ data: null, error: { message: "Secret DB internal error" } }));
const mockSelect = mock(() => ({
  eq: mockEq,
  or: mockOr,
}));

// Initial mock for .eq chain that ends with Promise
const mockEqFinal = mock(() => Promise.resolve({ data: null, error: { message: "Secret DB internal error" } }));
const mockEq3 = mock(() => ({ eq: mockEqFinal }));
const mockEq2 = mock(() => ({ eq: mockEq3 }));
const mockEq1 = mock(() => ({ eq: mockEq2 }));

const mockFrom = mock(() => ({
  select: mock(() => ({
    eq: mockEq1,
    or: mockOr,
  })),
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

// Mock getFullContext
mock.module("@/lib/queries", () => ({
  getFullContext: mock(async () => ({
    real_marque: "Porsche",
    real_famille: "911",
    real_modele: "GT3",
  })),
}));

describe("Security: Error logging in duels actions", () => {
  let fetchFighterReviews: any;
  let fetchBatchFighterReviews: any;
  let consoleSpy: any;

  beforeEach(async () => {
    // Reset mocks
    mockFrom.mockClear();
    mockEq1.mockClear();
    mockOr.mockClear();

    // Spy on console.error
    consoleSpy = spyOn(console, "error").mockImplementation(() => {});

    // Re-import module
    const module = await import("./duels");
    fetchFighterReviews = module.fetchFighterReviews;
    fetchBatchFighterReviews = module.fetchBatchFighterReviews;
  });

  it("fetchFighterReviews should NOT log detailed Supabase error message", async () => {
    const slug = "porsche_911_2022_gt3";
    await fetchFighterReviews(slug);

    // Verify console.error was called
    expect(consoleSpy).toHaveBeenCalled();

    // Verify it does NOT contain the secret error message
    const lastCall = consoleSpy.mock.calls.find((call: any) => call[0].includes("❌ Erreur Supabase:"));
    expect(lastCall[0]).not.toContain("Secret DB internal error");
    expect(lastCall[0]).toContain("An unexpected error occurred");
  });

  it("fetchBatchFighterReviews should NOT log detailed Supabase error message", async () => {
    const slugs = ["porsche_911_2022_gt3"];
    await fetchBatchFighterReviews(slugs);

    // Verify console.error was called
    expect(consoleSpy).toHaveBeenCalled();

    // Verify it does NOT contain the secret error message
    const lastCall = consoleSpy.mock.calls.find((call: any) => call[0].includes("❌ Erreur Supabase Batch:"));
    expect(lastCall[0]).not.toContain("Secret DB internal error");
    expect(lastCall[0]).toContain("An unexpected error occurred");
  });
});
