import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// 1. Setup happy-dom BEFORE importing React
GlobalRegistrator.register();

// 2. Mock imports
const mockUseSearchParams = mock(() => new URLSearchParams("left=Audi_A3_2020_Sportback&right=BMW_1_2020_Series"));
const mockUseRouter = mock(() => ({
  replace: mock(),
  push: mock(),
}));

// Mock next/navigation
mock.module("next/navigation", () => ({
  useSearchParams: mockUseSearchParams,
  useRouter: mockUseRouter,
}));

// Mock server actions
const mockFetchFighterReviews = mock(async (slug: string) => {
  return [
    {
      supabase_id: 1,
      MY: 2020,
      Marque: "Audi",
      Famille: "A3",
      Modele: "Sportback",
      Type: "Essence",
      Puissance: 150,
      Transmission: "Auto",
      Finition: "S Line",
      Testeur: "AutoPlus",
      Test_date: "2020/01",
      Score: 15,
    },
  ];
});

const mockFetchBatchFighterReviews = mock(async (slugs: string[]) => {
    const result: any = {};
    slugs.forEach(slug => {
        result[slug] = [
            {
              supabase_id: 1,
              MY: 2020,
              Marque: slug.split("_")[0],
              Famille: slug.split("_")[1],
              Modele: slug.split("_").slice(3).join("_"),
              Type: "Essence",
              Puissance: 150,
              Transmission: "Auto",
              Finition: "S Line",
              Testeur: "AutoPlus",
              Test_date: "2020/01",
              Score: 15,
            }
        ];
    });
    return result;
});

mock.module("@/actions/duels", () => ({
  fetchFighterReviews: mockFetchFighterReviews,
  fetchBatchFighterReviews: mockFetchBatchFighterReviews,
}));

// 3. Import component AFTER mocks and happy-dom
import React from "react";
import { render, waitFor } from "@testing-library/react";
import DuelPageClient from "./DuelPageClient";

describe("DuelPageClient", () => {
  it("should trigger ONE batch fetch call for two params (Optimized)", async () => {
    // Render component
    render(<DuelPageClient />);

    // Wait for effects to run
    await waitFor(() => {
      // Check that fetchBatchFighterReviews is called
      expect(mockFetchBatchFighterReviews).toHaveBeenCalled();
    });

    // Check call count
    expect(mockFetchBatchFighterReviews).toHaveBeenCalledTimes(1);

    // Check arguments
    const calls = mockFetchBatchFighterReviews.mock.calls;
    const args = calls[0][0] as string[]; // first arg of first call
    expect(args).toHaveLength(2);
    expect(args).toContain("Audi_A3_2020_Sportback");
    expect(args).toContain("BMW_1_2020_Series");

    // Ensure the old method is NOT called directly by the component
    // (Note: fetchBatchFighterReviews implementation might call it internally, but the COMPONENT should not call it)
    // However, since we mocked the MODULE, and the component imports from the MODULE,
    // and fetchBatchFighterReviews is also in the MODULE...
    // The component calls `fetchBatchFighterReviews`.
    // The component does NOT call `fetchFighterReviews`.
    expect(mockFetchFighterReviews).toHaveBeenCalledTimes(0);
  });
});
