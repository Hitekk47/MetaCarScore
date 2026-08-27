import { describe, it, expect } from "bun:test";

describe("ReviewsTableCompact rebranding display", () => {
  const sampleData = [
    {
      supabase_id: "1",
      Marque: "Chery",
      Famille: "Tiggo 7",
      Modele: "Tiggo 7 Pro",
      MY: 2024,
      Puissance: 150,
      Transmission: "Auto",
      Type: "Essence",
      Score: 80,
      Testeur: "TopGear",
      Test_date: "2024-01-01",
    },
    {
      supabase_id: "2",
      Marque: "Ebro",
      Famille: "S700",
      Modele: "S700 Luxury",
      MY: 2024,
      Puissance: 150,
      Transmission: "Auto",
      Type: "Essence",
      Score: 85,
      Testeur: "AutoExpress",
      Test_date: "2024-02-01",
    },
  ];

  it("should show full brand + model for aliased reviews when hideBrand is true but pageMarque differs", () => {
    const renderTitle = (row: typeof sampleData[0], hideBrand: boolean, pageMarque?: string) => {
      return hideBrand && pageMarque && row.Marque.toLowerCase() !== pageMarque.toLowerCase()
        ? `${row.Marque} ${row.Modele}`
        : hideBrand
        ? row.Modele
        : `${row.Marque} ${row.Modele}`;
    };

    expect(renderTitle(sampleData[0], true, "Chery")).toBe("Tiggo 7 Pro");
    expect(renderTitle(sampleData[1], true, "Chery")).toBe("Ebro S700 Luxury");
  });
});
