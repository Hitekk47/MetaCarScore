"use client";

import { motion } from "framer-motion";
import { Info, BarChart3, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeoSummaryCardProps {
  text: string;
  className?: string;
}

export default function SeoSummaryCard({ text, className }: SeoSummaryCardProps) {
  if (!text) return null;

  // Function to highlight metrics in the text
  const formatText = (content: string) => {
    // Regex to match scores (e.g., 75/100), percentages (e.g., 80%), and rankings (e.g., 1er, 4ème sur 32)
    // We also look for keywords like "consensus" or "fortes divisions"
    const parts = content.split(/(\d+(?:\/\d+|%)|\b\d+(?:er|ème)\b sur \d+|\bconsensus\b|\bfortes divisions\b|\bau-dessus\b|\ben-dessous\b)/gi);

    return parts.map((part, i) => {
      const lowerPart = part.toLowerCase();
      const isMetric = /\d+(?:\/\d+|%)|er|ème|sur/.test(lowerPart);
      const isHighlight = /consensus|fortes divisions|au-dessus|en-dessous/.test(lowerPart);

      if (isMetric || isHighlight) {
        return (
          <span key={i} className="font-bold text-blue-400">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className={cn(
        "bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 text-slate-300 leading-relaxed shadow-2xl relative overflow-hidden group",
        className
      )}
    >
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <BarChart3 size={40} />
      </div>

      <div className="flex items-start gap-4">
        <div className="mt-1 bg-blue-500/20 p-2 rounded-lg text-blue-400 shrink-0">
          <TrendingUp size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 flex items-center gap-2">
            Analyse Data Storytelling
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          </h4>
          <p className="text-sm md:text-base">
            {formatText(text)}
          </p>
        </div>
      </div>

      {/* Decorative gradient border bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-30" />
    </motion.div>
  );
}
