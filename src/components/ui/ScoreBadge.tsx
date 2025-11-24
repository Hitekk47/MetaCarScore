"use client";

import { getScoreColor } from "@/lib/utils";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { Filter, Lock } from "lucide-react";

function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(count, value, { duration: 1, ease: "circOut" });
    return controls.stop;
  }, [value, count]);

  return <motion.span>{rounded}</motion.span>;
}

export default function ScoreBadge({ 
  score, 
  size = "md", 
  isFiltered = false,
  reviewCount 
}: { 
  score: number, 
  size?: "sm" | "md" | "lg" | "xl",
  isFiltered?: boolean,
  reviewCount?: number
}) {
  const isPending = reviewCount !== undefined && reviewCount < 3;

  const colors = isPending 
    ? { bg: "bg-slate-200", text: "text-slate-400" } 
    : getScoreColor(score);
  
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-lg",
    lg: "w-20 h-20 text-3xl",
    xl: "w-32 h-32 md:w-40 md:h-40", 
  };

  const textSize = size === 'xl' ? 'text-6xl md:text-7xl' : '';

  return (
    <div className={`relative ${sizeClasses[size]} shrink-0`}> 
      
      <motion.div 
        layout
        className={`
          w-full h-full
          ${colors.bg} 
          ${colors.text} 
          rounded flex flex-col items-center justify-center 
          font-black shadow-sm leading-none select-none overflow-visible
          relative z-10
          ${isFiltered && !isPending ? 'ring-4 ring-offset-2 ring-offset-slate-900 ring-orange-500' : ''}
        `}
        initial={false}
        animate={{ 
          backgroundColor: colors.bg.replace('bg-', ''),
          scale: isFiltered ? 0.95 : 1 
        }} 
        transition={{ duration: 0.5 }}
      >
        {isPending ? (
          <>
            <Lock size={size === 'xl' ? 48 : 24} className="opacity-20 mb-1" />
            <span className={size === 'xl' ? "text-4xl opacity-50" : "text-sm"}>--</span>
          </>
        ) : (
          <span className={textSize}>
            <AnimatedNumber value={score} />
          </span>
        )}

        {size === 'xl' && (
          <span className="text-[10px] md:text-xs uppercase font-bold opacity-50 tracking-wider mt-1 md:mt-2 text-center px-2">
              {isPending 
                ? "Données insuffisantes" 
                : (isFiltered ? "Score Filtré" : "MetaCarScore")
              }
          </span>
        )}
      </motion.div>

      {/* BADGE "FILTRÉ" */}
      {isFiltered && !isPending && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -top-3 -right-6 z-20 bg-orange-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg flex items-center gap-1 border-2 border-slate-900 rotate-3"
        >
          <Filter size={10} fill="currentColor" />
          Filtré
        </motion.div>
      )}

      {/* TOOLTIP "MIN 3 ESSAIS" */}
      {isPending && size === 'xl' && (
         <motion.div 
         // CORRECTION 1 : On passe de 'mt-4' à 'mt-2' (ou 1.5) pour remonter la bulle
         // La pointe de la flèche va maintenant toucher le rectangle du dessus
         initial={{ opacity: 0, y: -5, x: "-50%" }}
         animate={{ opacity: 1, y: 0, x: "-50%" }}
         className="absolute top-full mt-2 left-1/2 w-max text-[10px] font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 shadow-xl z-20"
       >
         Min. 3 essais requis
         
         {/* CORRECTION 2 : Ajustement fin de la position de la flèche (-top-1.5) pour une fusion parfaite */}
         <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-800 border-t border-l border-slate-700 transform rotate-45"></div>
       </motion.div>
      )}

    </div>
  );
}