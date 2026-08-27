import { describe, it, expect, mock } from "bun:test";

mock.module("clsx", () => ({
  clsx: (...args: unknown[]) => args.join(" "),
  default: (...args: unknown[]) => args.join(" "),
}));

mock.module("tailwind-merge", () => ({
  twMerge: (arg: string) => arg,
}));

import { formatAliasDisplay } from "./utils";
import { ModelAlias } from "./types";

describe("formatAliasDisplay", () => {
  it("should return empty string when aliases array is empty or undefined", () => {
    expect(formatAliasDisplay([], "Chery")).toBe("");
    expect(formatAliasDisplay(undefined as unknown as ModelAlias[], "Chery")).toBe("");
  });

  it("should format a single alias with different brand", () => {
    const aliases: ModelAlias[] = [
      {
        canonical_marque: "Chery",
        canonical_famille: "Tiggo 7",
        canonical_modele: "Tiggo 7",
        alias_marque: "Ebro",
        alias_famille: "S700",
        alias_modele: "S700"
      }
    ];

    expect(formatAliasDisplay(aliases, "Chery")).toBe("Également commercialisé sous le nom : Ebro S700");
  });

  it("should format a single alias with same brand omitting brand name", () => {
    const aliases: ModelAlias[] = [
      {
        canonical_marque: "GWM",
        canonical_famille: "Ora 03",
        canonical_modele: "Ora 03",
        alias_marque: "GWM",
        alias_famille: "Ora Funky Cat",
        alias_modele: "Ora Funky Cat"
      }
    ];

    expect(formatAliasDisplay(aliases, "GWM")).toBe("Également commercialisé sous le nom : Ora Funky Cat");
  });

  it("should format multiple aliases correctly", () => {
    const aliases: ModelAlias[] = [
      {
        canonical_marque: "Chery",
        canonical_famille: "Tiggo 7",
        canonical_modele: "Tiggo 7",
        alias_marque: "Ebro",
        alias_famille: "S700",
        alias_modele: "S700"
      },
      {
        canonical_marque: "Chery",
        canonical_famille: "Tiggo 7",
        canonical_modele: "Tiggo 7",
        alias_marque: "Chery",
        alias_famille: "Tiggo Cross",
        alias_modele: "Tiggo Cross"
      }
    ];

    expect(formatAliasDisplay(aliases, "Chery")).toBe("Également commercialisé sous les noms : Ebro S700, Tiggo Cross");
  });
});
