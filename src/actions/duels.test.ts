import { describe, expect, test, mock } from "bun:test";

// Mock external dependencies
mock.module('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        or: (query: string) => ({ data: [], error: null })
      })
    })
  })
}));

mock.module('next/cache', () => ({
  unstable_cache: (fn: any) => fn
}));

mock.module('@/lib/queries', () => ({
  getFullContext: async () => ({
    real_marque: 'Brand"WithQuotes',
    real_famille: 'Family',
    real_modele: 'Model',
  })
}));

mock.module('react', () => ({
  cache: (fn: any) => fn
}));

describe("Security: PostgREST Injection", () => {
  test("should escape double quotes in batch query", async () => {
    let capturedOrQuery = "";

    // Mock to capture the query
    mock.module('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            or: (query: string) => {
              capturedOrQuery = query;
              return { data: [], error: null };
            }
          })
        })
      })
    }));

    const { fetchBatchFighterReviews } = await import("./duels?v=1");

    await fetchBatchFighterReviews(["brand_family_2024_model"]);

    // If Brand"WithQuotes is not escaped, it will be "Brand"WithQuotes"
    // If it is escaped (doubled), it will be "Brand""WithQuotes"
    expect(capturedOrQuery).toContain('"Brand""WithQuotes"');
  });
});
