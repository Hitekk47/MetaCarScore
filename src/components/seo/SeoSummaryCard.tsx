"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  text: string;
  iqr?: number;
};

type TooltipProps = {
  type: "consensus" | "nuance" | "division";
  label: string;
  iqr?: number;
};

function Tooltip({ type, label, iqr }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState(0);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const padding = 12;
      const width = rect.width;
      const halfWidth = width / 2;

      let newOffset = 0;
      if (coords.x - halfWidth < padding) {
        newOffset = padding - (coords.x - halfWidth);
      } else if (coords.x + halfWidth > window.innerWidth - padding) {
        newOffset = window.innerWidth - padding - (coords.x + halfWidth);
      }
      setOffset(newOffset);
    } else {
      setOffset(0);
    }
  }, [isOpen, coords.x]);

  const getTooltipText = () => {
    if (iqr === undefined) return "";
    switch (type) {
      case "consensus":
        return `Consensus élevé entre les essais : écart interquartile de ${iqr}`;
      case "nuance":
        return `Écarts d’appréciation modérés entre les essais : écart interquartile de ${iqr}`;
      case "division":
        return `Écarts d’appréciation marqués entre les essais : écart interquartile de ${iqr}`;
      default:
        return `Écart interquartile : ${iqr}`;
    }
  };

  useEffect(() => {
    const handleClose = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClose);
      document.addEventListener("touchstart", handleClose);
    }
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("touchstart", handleClose);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // For keyboard, we center it on the button
      const rect = e.currentTarget.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top });
      setIsOpen(!isOpen);
    }
  };

  const updateCoords = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    let x = 0;
    let y = 0;

    if ('touches' in e && e.touches.length > 0) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }

    if (x !== 0 || y !== 0) {
      setCoords({ x, y });
    }
  };

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    updateCoords(e);
    setIsOpen(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && isOpen) {
      updateCoords(e);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    updateCoords(e);
    setIsOpen((prev) => !prev);
  };

  return (
    <span className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        tabIndex={-1}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setIsOpen(false)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="text-blue-400 font-medium cursor-help border-b border-dotted border-blue-400/50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
      >
        {label}
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && iqr !== undefined && (
            <motion.span
              ref={tooltipRef}
              initial={{ opacity: 0, x: `calc(-50% + ${offset}px)`, y: "-100%", scale: 0.95, marginTop: -8 }}
              animate={{ opacity: 1, x: `calc(-50% + ${offset}px)`, y: "-100%", scale: 1, marginTop: -16 }}
              exit={{ opacity: 0, x: `calc(-50% + ${offset}px)`, y: "-100%", scale: 0.95, marginTop: -8 }}
              role="tooltip"
              style={{
                position: 'fixed',
                left: coords.x,
                top: coords.y,
              }}
              className="px-3 py-2 bg-slate-900 text-white text-[11px] md:text-xs rounded-lg shadow-2xl border border-slate-700 z-[9999] min-w-[200px] max-w-[280px] text-center leading-snug pointer-events-none"
            >
              <span className="relative flex items-center justify-center gap-2">
                {getTooltipText()}
              </span>
              <span
                className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"
                style={{ marginLeft: -offset }}
              />
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}

export default function SeoSummaryCard({ text, iqr }: Props) {
  if (!text) return null;

  const parseText = (rawText: string) => {
    // Regex robuste pour capturer [[category:type|label]]
    // On capture aussi les patterns de classement et de score pour la mise en forme
    const parts = rawText.split(/(\[\[.*?:.*?\|.*?\]\]|\d+(?:er|e)\/\d+|MetaCarScore de \d+)/g);

    return parts.map((part, index) => {
      if (!part) return null;

      const markerMatch = part.match(/\[\[(.*?):(.*?)\|(.*?)\]\]/);
      if (markerMatch) {
        const [, category, type, label] = markerMatch;

        // Si c'est un marqueur iqr et qu'on a la donnée iqr, on affiche le tooltip
        if (category === 'iqr' && iqr !== undefined) {
          return <Tooltip key={index} type={type as any} label={label} iqr={iqr} />;
        }

        // Sinon (autre catégorie ou iqr manquant), on affiche juste le label net
        return label;
      }

      if (part.match(/\d+(?:er|e)\/\d+/)) {
        return <span key={index} className="text-blue-400 font-semibold">{part}</span>;
      }

      if (part.match(/MetaCarScore de \d+/)) {
        return <span key={index} className="text-blue-400 font-bold">{part}</span>;
      }

      return part;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="w-full"
    >
      <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden group">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -translate-x-full"
          animate={{ translateX: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        />

        <div className="relative z-10 flex gap-4 md:gap-6 items-start">
          <div className="shrink-0 mt-1">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Info size={20} className="text-blue-400" />
            </div>
          </div>

          <div className="flex-grow space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Ce qu’en pense la presse</span>
              <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <div className="text-slate-300 text-sm md:text-base leading-relaxed font-medium italic">
              {parseText(text)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
