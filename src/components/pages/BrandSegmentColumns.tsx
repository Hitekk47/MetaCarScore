"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, MoveHorizontal } from "lucide-react";
import { groupDirectoryBySegment } from "@/lib/directory-segments";
import { cn } from "@/lib/utils";
import { PAGE_CONTAINER, WIDE_PAGE_CONTAINER } from "@/lib/layout";
import DirectoryCard from "./DirectoryCard";
import type { DirectoryItem } from "./directory-types";

export default function BrandSegmentColumns({ items }: { items: DirectoryItem[] }) {
  const groups = groupDirectoryBySegment(items);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setScroll({
      previous: element.scrollLeft > 1,
      next: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    });
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
    const column = element.firstElementChild as HTMLElement | null;
    element.scrollBy({
      left: direction * ((column?.offsetWidth ?? element.clientWidth) + 16),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };
  return (
    <section aria-label="Gamme par segment" className={cn("min-w-0", groups.length >= 4 ? WIDE_PAGE_CONTAINER : PAGE_CONTAINER)}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
      <div ref={scrollRef} id="brand-segments" role="region" aria-label="Segments de la marque, défilement horizontal" tabIndex={0} className={cn(
        "grid grid-flow-col items-start gap-4 overflow-x-auto overscroll-x-contain snap-x snap-proximity pb-5 rounded-2xl focus-visible:outline-blue-600",
        groups.length === 1 ? "auto-cols-[100%] sm:auto-cols-[20rem]" : "auto-cols-[85%] sm:auto-cols-[18rem] lg:auto-cols-[19rem]"
      )}>
        {groups.map(group => (
          <section key={group.id} aria-label={group.macro ? `${group.label} · ${group.macro}` : group.label} className="min-w-0 snap-start rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex min-h-28 items-start gap-3 px-1 py-3">
              <span aria-hidden="true" className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 px-2 text-xs font-black text-blue-700">{group.code ?? "?"}</span>
              <div className="min-w-0">
                {group.macro && <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.macro}</p>}
                <h3 className="mt-1 text-lg font-black leading-tight text-slate-900">{group.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{group.items.length} gamme{group.items.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="space-y-3">
              {group.items.map(({ item, latestMy }) => <DirectoryCard key={item.id} item={{ ...item, colorClass: "bg-white border-slate-200 text-slate-700" }} latestMy={latestMy} />)}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
