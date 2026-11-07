"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, MoveHorizontal } from "lucide-react";
import { groupDirectoryBySegment } from "@/lib/directory-segments";
import { cn } from "@/lib/utils";
import { PAGE_CONTAINER, WIDE_PAGE_CONTAINER } from "@/lib/layout";
import DirectoryCard from "./DirectoryCard";
import type { DirectoryItem } from "./directory-types";

export default function BrandSegmentColumns({ items }: { items: DirectoryItem[] }) {
  const groups = groupDirectoryBySegment(items);
  const macros: { label: string; start: number; segments: typeof groups }[] = [];
  for (const group of groups) {
    const label = group.macro ?? "Autres segments";
    const previous = macros[macros.length - 1];
    if (previous?.label === label) {
      previous.segments.push(group);
    } else {
      // One extra grid track separates each macro-category from the next.
      const start = previous ? previous.start + previous.segments.length + 1 : 1;
      macros.push({ label, start, segments: [group] });
    }
  }
  // Column widths, gaps, and the extra spacer track at each macro boundary.
  const contentWidth = `calc(${groups.length} * var(--segment-width) + ${groups.length + 2 * macros.length - 3}rem)`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      const previous = element.scrollLeft > 1;
      const next = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
      setScroll(current => current.previous === previous && current.next === next ? current : { previous, next });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items]);
  const move = (direction: number) => {
    const element = scrollRef.current;
    if (!element) return;
    const left = element.getBoundingClientRect().left;
    const positions = [...element.querySelectorAll<HTMLElement>("[data-segment-column]")]
      .map(column => column.getBoundingClientRect().left - left + element.scrollLeft);
    const target = direction > 0
      ? positions.find(position => position > element.scrollLeft + 1)
      : positions.reverse().find(position => position < element.scrollLeft - 1);
    element.scrollTo({
      left: target ?? (direction > 0 ? element.scrollWidth : 0),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };
  return (
    <section aria-label="Gamme par segment" className={cn(
      "min-w-0", groups.length >= 4 ? WIDE_PAGE_CONTAINER : PAGE_CONTAINER,
      groups.length === 1 ? "[--segment-width:100%] sm:[--segment-width:20rem]" : "[--segment-width:85%] sm:[--segment-width:18rem] lg:[--segment-width:19rem]"
    )}>
      <div style={groups.length >= 4 ? { maxWidth: contentWidth } : undefined} className="mx-auto mb-5 flex w-full flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight">La gamme par segment</h2>
          <p className="mt-1 text-sm text-slate-500">{groups.length} segment{groups.length > 1 ? "s" : ""} · Années-modèles les plus récentes en premier</p>
        </div>
        {(scroll.previous || scroll.next) && (
          <div className="flex items-center gap-2">
            <MoveHorizontal size={16} aria-hidden="true" className="text-slate-400" />
            <span className="mr-1 text-xs text-slate-500">Faire défiler</span>
            <button type="button" onClick={() => move(-1)} disabled={!scroll.previous} aria-label="Segments précédents" aria-controls="brand-segments" className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-30 hover:enabled:bg-slate-100 focus-visible:outline-blue-600"><ArrowLeft size={18} aria-hidden="true" /></button>
            <button type="button" onClick={() => move(1)} disabled={!scroll.next} aria-label="Segments suivants" aria-controls="brand-segments" className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-30 hover:enabled:bg-slate-100 focus-visible:outline-blue-600"><ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        )}
      </div>
      <div style={{ gridTemplateColumns: macros.map(macro => `repeat(${macro.segments.length}, var(--segment-width))`).join(" 1rem ") }} ref={scrollRef} id="brand-segments" role="region" aria-label="Segments de la marque, défilement horizontal" tabIndex={0} className={cn(
        "grid items-start gap-4 overflow-x-auto overscroll-x-contain snap-x snap-proximity [@media(hover:hover)_and_(pointer:fine)]:snap-none pb-5 rounded-2xl focus-visible:outline-blue-600",
        groups.length >= 4 && "[justify-content:safe_center]"
      )}>
        {macros.map(macro => (
          <Fragment key={macro.label}>
            <div style={{ gridColumn: `${macro.start} / span ${macro.segments.length}`, gridRow: 1 }} className="self-stretch rounded-xl border-l-4 border-blue-600 bg-blue-50">
              <div className="sticky left-0 flex w-fit max-w-[85vw] flex-wrap items-center gap-2 px-4 py-3">
                <h3 className="text-base font-black tracking-tight text-slate-900">{macro.label}</h3>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">{macro.segments.length} segment{macro.segments.length > 1 ? "s" : ""}</span>
              </div>
            </div>
            {macro.segments.map((group, index) => (
              <section data-segment-column style={{ gridColumn: macro.start + index, gridRow: 2 }} key={group.id} aria-label={group.macro ? `${group.label} · ${group.macro}` : group.label} className="min-w-0 snap-start rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex min-h-28 items-start gap-3 px-1 py-3">
                  <span aria-hidden="true" className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 px-2 text-xs font-black text-blue-700">{group.code ?? "?"}</span>
                  <div className="min-w-0">
                    <h4 className="mt-1 text-lg font-black leading-tight text-slate-900">{group.label}</h4>
                    <p className="mt-1 text-xs text-slate-500">{group.items.length} gamme{group.items.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {group.items.map(({ item }) => <DirectoryCard key={item.id} item={item} headingAs="h5" />)}
                </div>
              </section>
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
