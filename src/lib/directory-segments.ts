import { MACRO_CONFIG } from "./constants";
import type { FamilySegment } from "./types";

type SegmentedItem = {
  id: string;
  title: string;
  latestMy?: number | null;
  segments?: FamilySegment[];
};

export type DirectorySegmentGroup<T> = {
  id: string;
  macro: string | null;
  code: string | null;
  label: string;
  items: { item: T; latestMy: number | null }[];
};

export function groupDirectoryBySegment<T extends SegmentedItem>(items: T[]): DirectorySegmentGroup<T>[] {
  const groups = new Map<string, DirectorySegmentGroup<T>>();
  for (const item of items) {
    const segments = item.segments?.length
      ? item.segments
      : [{ macro: null, size: null, latest_my: item.latestMy ?? null }];
    for (const segment of segments) {
      const id = JSON.stringify([segment.macro, segment.size]);
      let group = groups.get(id);
      if (!group) {
        const config = MACRO_CONFIG.find(macro => macro.label === segment.macro);
        const definition = config?.segments.find(s => s.code === segment.size);
        group = {
          id,
          macro: segment.macro,
          code: segment.size,
          label: definition?.singularLabel ?? definition?.label
            ?? segment.size ?? "Segment non renseigné",
          items: [],
        };
        groups.set(id, group);
      }
      const existing = group.items.find(entry => entry.item.id === item.id);
      if (existing) {
        existing.latestMy = Math.max(existing.latestMy ?? 0, segment.latest_my ?? 0) || null;
      } else {
        group.items.push({ item, latestMy: segment.latest_my });
      }
    }
  }
  const macroOrder = (macro: string | null) => {
    const index = MACRO_CONFIG.findIndex(config => config.label === macro);
    return index === -1 ? MACRO_CONFIG.length : index;
  };
  const segmentOrder = (group: DirectorySegmentGroup<T>) => {
    const config = MACRO_CONFIG.find(macro => macro.label === group.macro);
    const index = config?.segments.findIndex(segment => segment.code === group.code) ?? -1;
    return index === -1 ? 100 : index;
  };
  for (const group of groups.values()) {
    group.items.sort((a, b) =>
      (b.latestMy ?? 0) - (a.latestMy ?? 0) || a.item.title.localeCompare(b.item.title, "fr")
    );
  }
  return [...groups.values()].sort((a, b) =>
    macroOrder(a.macro) - macroOrder(b.macro)
    || (a.macro ?? "\uffff").localeCompare(b.macro ?? "\uffff", "fr")
    || segmentOrder(a) - segmentOrder(b)
    || a.label.localeCompare(b.label, "fr")
  );
}
