"use client";

import { motion } from "framer-motion";
import { Info } from "lucide-react";

type Props = {
  text: string;
  iqr?: number;
};

export default function SeoSummaryCard({ text, iqr }: Props) {
  if (!text) return null;

  const formatText = (rawText: string) => {
    const highlighted = rawText
        .replace(/(\d+(er|e)\/\d+)/g, '<span class="text-blue-600 font-semibold">$1</span>')
        .replace(/(MetaCarScore de \d+)/g, '<span class="text-blue-600 font-bold">$1</span>')
        .replace(/(consensus|certaines nuances|forte division)/g, (match) => {
            return `<span class="text-blue-500 font-medium group/tooltip relative cursor-help border-b border-dotted border-blue-500/50">
                ${match}
                ${iqr !== undefined ? `
                <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50 border border-slate-700">
                    Écart interquartile : ${iqr}
                </span>
                ` : ''}
            </span>`;
        });

    return <div dangerouslySetInnerHTML={{ __html: highlighted }} />;
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
                    {formatText(text)}
                </div>
            </div>
        </div>
      </div>
    </motion.div>
  );
}
