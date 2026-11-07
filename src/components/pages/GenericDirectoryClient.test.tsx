import { afterEach, describe, expect, it, mock } from "bun:test";
import { Window } from "happy-dom";
import React from "react";
import type { DirectoryItem } from "./directory-types";

const window = new Window({ url: "http://localhost:3000/fixture" });
global.window = window as unknown as Window & typeof globalThis;
global.document = window.document as unknown as Document;
global.navigator = window.navigator as unknown as Navigator;
global.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
global.HTMLInputElement = window.HTMLInputElement as unknown as typeof HTMLInputElement;
global.Element = window.Element as unknown as typeof Element;
global.SVGElement = window.SVGElement as unknown as typeof SVGElement;
global.Event = window.Event as unknown as typeof Event;
global.MouseEvent = window.MouseEvent as unknown as typeof MouseEvent;
global.KeyboardEvent = window.KeyboardEvent as unknown as typeof KeyboardEvent;
global.ResizeObserver = window.ResizeObserver as unknown as typeof ResizeObserver;

// Keep layout-independent component tests deterministic; browser tests cover the
// real scroll geometry, touch behavior and responsiveness.
window.matchMedia = (() => ({
  matches: true,
  addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {},
})) as unknown as typeof window.matchMedia;

mock.module("@/components/Header", () => ({ default: () => <header /> }));
mock.module("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));

const { render, cleanup, within, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { default: GenericDirectoryClient } = await import("./GenericDirectoryClient");

const items: DirectoryItem[] = [
  { id: "zulu", title: "Zulu", subtitle: "40 Essais", href: "/fixture/zulu", latestMy: 2026,
    segments: [{ macro: "SUV / Crossover", size: "C", latest_my: 2024 }, { macro: "Berline / Hatch", size: "C", latest_my: 2026 }] },
  { id: "alpha", title: "Alpha", subtitle: "8 Essais", href: "/fixture/alpha", latestMy: 2025,
    segments: [{ macro: "SUV / Crossover", size: "C", latest_my: 2025 }] },
  { id: "beta", title: "Beta", subtitle: "3 Essais", href: "/fixture/beta", latestMy: 2025,
    segments: [{ macro: "SUV / Crossover", size: "C", latest_my: 2025 }] },
  { id: "missing", title: "Inconnu", subtitle: "1 Essai", href: "/fixture/inconnu", latestMy: 2023, segments: [] },
];

function setup(segmented = true, directoryItems = items) {
  const view = render(<GenericDirectoryClient title="Fixture" subtitle="La gamme" items={directoryItems} placeholderSearch="Filtrer la gamme" segmented={segmented} />);
  const user = userEvent.setup({ document: window.document as unknown as Document });
  return { ...view, user };
}

afterEach(() => cleanup());

describe("GenericDirectoryClient brand views", () => {
  it("starts with segmented columns, preserves multi-segment families and uses the segment-specific MY", () => {
    const view = setup();
    expect(view.getByRole("button", { name: "Par segment" }).getAttribute("aria-pressed")).toBe("true");
    expect(view.queryByRole("combobox")).toBeNull();
    const suv = within(view.getByRole("region", { name: "SUV Compacts · SUV / Crossover" }));
    expect(suv.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([
      "/fixture/alpha", "/fixture/beta", "/fixture/zulu",
    ]);
    expect(within(suv.getByRole("link", { name: /Zulu/ })).getByText("MY 2024")).toBeTruthy();
    const hatch = within(view.getByRole("region", { name: "Compactes · Berline / Hatch" }));
    expect(hatch.getByText("MY 2026")).toBeTruthy();
    expect(within(view.getByRole("region", { name: "Segment non renseigné" })).getByRole("link", { name: /Inconnu/ })).toBeTruthy();
  });

  it("keeps the original review order and alphabetical selection when returning from the segmented view", async () => {
    const view = setup();
    await view.user.click(view.getByRole("button", { name: "Simple", exact: true }));
    const links = () => view.getAllByRole("link").map(link => link.getAttribute("href"));
    expect(links()).toEqual(["/fixture/zulu", "/fixture/alpha", "/fixture/beta", "/fixture/inconnu"]);
    await view.user.selectOptions(view.getByRole("combobox", { name: "Trier par" }), "alpha");
    expect(links()).toEqual(["/fixture/alpha", "/fixture/beta", "/fixture/inconnu", "/fixture/zulu"]);

    await view.user.click(view.getByRole("button", { name: "Par segment", exact: true }));
    await view.user.click(view.getByRole("button", { name: "Simple", exact: true }));
    expect((view.getByRole("combobox") as HTMLSelectElement).value).toBe("alpha");
    expect(links()).toEqual(["/fixture/alpha", "/fixture/beta", "/fixture/inconnu", "/fixture/zulu"]);
    await view.user.selectOptions(view.getByRole("combobox"), "reviews");
    expect(links()).toEqual(["/fixture/zulu", "/fixture/alpha", "/fixture/beta", "/fixture/inconnu"]);
  });

  it("applies the same search in both views, reports empty results and clears with focus restored", async () => {
    const view = setup();
    const search = view.getByRole("textbox", { name: "Filtrer la gamme" });
    await view.user.type(search, "ALPHA");
    expect(view.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/fixture/alpha"]);
    expect(view.queryByRole("region", { name: "Compactes · Berline / Hatch" })).toBeNull();
    await view.user.click(view.getByRole("button", { name: "Simple", exact: true }));
    expect(view.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/fixture/alpha"]);
    await view.user.type(search, "introuvable");
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("ALPHAintrouvable"));
    await view.user.click(view.getByRole("button", { name: "Effacer la recherche" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(search);
    expect(view.getAllByRole("link")).toHaveLength(items.length);
  });

  it("retains canonical destinations and alias information in both views", async () => {
    const view = setup(true, [{
      id: "s700", title: "S700", subtitle: "8 Essais", href: "/chery/tiggo-7", isAlias: true,
      canonicalMarque: "Chery", canonicalFamille: "Tiggo 7",
      segments: [{ macro: "SUV / Crossover", size: "C", latest_my: 2025 }],
    }]);
    expect(view.getByRole("link", { name: /S700/ }).getAttribute("href")).toBe("/chery/tiggo-7");
    expect(view.getByText("Chery Tiggo 7")).toBeTruthy();
    await view.user.click(view.getByRole("button", { name: "Simple", exact: true }));
    expect(view.getByRole("link", { name: /S700/ }).getAttribute("href")).toBe("/chery/tiggo-7");
    expect(view.getByText("Chery Tiggo 7")).toBeTruthy();
  });

  it("keeps other directories in the simple view without a segmentation toggle", async () => {
    const view = setup(false);
    expect(view.queryByRole("group", { name: "Affichage de la gamme" })).toBeNull();
    expect(view.queryByRole("region", { name: "Gamme par segment" })).toBeNull();
    expect(view.getAllByRole("link")).toHaveLength(items.length);
    await view.user.click(view.getByTitle("Trier par ordre alphabétique"));
    expect(view.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([
      "/fixture/alpha", "/fixture/beta", "/fixture/inconnu", "/fixture/zulu",
    ]);
  });
});
