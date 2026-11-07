import { describe, expect, it } from "bun:test";
import { groupDirectoryBySegment } from "./directory-segments";
import type { FamilySegment } from "./types";

const segment = (macro: string, size: string, latest_my: number | null): FamilySegment => ({ macro, size, latest_my });

describe("groupDirectoryBySegment", () => {
  it("uses the configured macro and segment order rather than the input order", () => {
    const groups = groupDirectoryBySegment([
      { id: "suv-d", title: "SUV familial", segments: [segment("SUV / Crossover", "D", 2026)] },
      { id: "suv-c", title: "SUV compact", segments: [segment("SUV / Crossover", "C", 2025)] },
      { id: "hatch-c", title: "Compacte", segments: [segment("Berline / Hatch", "C", 2024)] },
      { id: "hatch-b", title: "Citadine", segments: [segment("Berline / Hatch", "B", 2023)] },
    ]);

    expect(groups.map(group => [group.macro, group.code, group.label])).toEqual([
      ["Berline / Hatch", "B", "Citadine"],
      ["Berline / Hatch", "C", "Compacte"],
      ["SUV / Crossover", "C", "SUV Compact"],
      ["SUV / Crossover", "D", "SUV Familial"],
    ]);
    expect(new Set(groups.map(group => group.id)).size).toBe(4);
  });

  it("sorts by the MY in each segment, then name, and puts missing years last", () => {
    const items = [
      { id: "old", title: "Ancienne", latestMy: 2026, segments: [segment("SUV / Crossover", "C", 2020)] },
      { id: "beta", title: "Beta", segments: [segment("SUV / Crossover", "C", 2025)] },
      { id: "unknown", title: "Année inconnue", segments: [segment("SUV / Crossover", "C", null)] },
      { id: "alpha", title: "Alpha", segments: [segment("SUV / Crossover", "C", 2025)] },
    ];
    const snapshot = JSON.stringify(items);

    const [group] = groupDirectoryBySegment(items);

    expect(group.items.map(entry => [entry.item.id, entry.latestMy])).toEqual([
      ["alpha", 2025], ["beta", 2025], ["old", 2020], ["unknown", null],
    ]);
    expect(JSON.stringify(items)).toBe(snapshot);
  });

  it("keeps a multi-segment family in each relevant column with its own MY", () => {
    const groups = groupDirectoryBySegment([{
      id: "family", title: "Gamme", latestMy: 2026,
      segments: [segment("SUV / Crossover", "C", 2022), segment("Berline / Hatch", "C", 2026)],
    }]);

    expect(groups.map(group => [group.macro, group.items[0].item.id, group.items[0].latestMy])).toEqual([
      ["Berline / Hatch", "family", 2026], ["SUV / Crossover", "family", 2022],
    ]);
  });

  it("retains unknown segments and unsegmented families after configured segments", () => {
    const groups = groupDirectoryBySegment([
      { id: "missing", title: "Sans segment", latestMy: 2024 },
      { id: "future", title: "Futur", segments: [segment("Catégorie future", "Z", 2026)] },
      { id: "empty", title: "Sans année", segments: [] },
      { id: "known", title: "Connue", segments: [segment("Berline / Hatch", "B", 2023)] },
      { id: "code", title: "Code futur", segments: [segment("Berline / Hatch", "Z", 2025)] },
    ]);

    expect(groups.map(group => group.label)).toEqual(["Citadine", "Z", "Z", "Segment non renseigné"]);
    expect(groups.at(-1)?.items.map(entry => [entry.item.id, entry.latestMy])).toEqual([
      ["missing", 2024], ["empty", null],
    ]);
    expect(groups.reduce((count, group) => count + group.items.length, 0)).toBe(5);
  });

  it("returns no columns for an empty directory", () => {
    expect(groupDirectoryBySegment([])).toEqual([]);
  });
});
