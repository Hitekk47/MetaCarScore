"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

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
  const containerRef = useRef<HTMLSpanElement>(null);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <span className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => !isOpen && setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="text-blue-500 font-medium cursor-help border-b border-dotted border-blue-500/50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
      >
        {label}
      </button>

      <AnimatePresence>
        {isOpen && iqr !== undefined && (
          <motion.span
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            role="tooltip"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[11px] md:text-xs rounded-lg shadow-2xl border border-slate-700 z-50 min-w-[200px] text-center leading-snug"
          >
            <span className="relative flex items-center justify-center gap-2">
              {getTooltipText()}
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="md:hidden p-1 hover:bg-slate-800 rounded"
              >
                <X size={12} />
              </button>
            </span>
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export default function SeoSummaryCard({ text, iqr }: Props) {
  if (!text) return null;

  const parseText = (rawText: string) => {
    // Regex to find ordinal ranks like 12e/88 or 1er/88
    const parts = rawText.split(/(\[\[iqr:[^\]]+\]\]|\d+(?:er|e)\/\d+|MetaCarScore de \d+)/g);

    return parts.map((part, index) => {
      if (!part) return null;

      // Handle [[iqr:type|label]]
      const iqrMatch = part.match(/\[\[iqr:(consensus|nuance|division)\|([^\]]+)\]\]/);
      if (iqrMatch) {
        const [, type, label] = iqrMatch;
        return <Tooltip key={index} type={type as any} label={label} iqr={iqr} />;
      }

      // Handle ordinal ranks
      if (part.match(/\d+(?:er|e)\/\d+/)) {
        return <span key={index} className="text-blue-600 font-semibold">{part}</span>;
      }

      // Handle MetaCarScore
      if (part.match(/MetaCarScore de \d+/)) {
        return <span key={index} className="text-blue-600 font-bold">{part}</span>;
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
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Analyse Sémantique</span>
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
