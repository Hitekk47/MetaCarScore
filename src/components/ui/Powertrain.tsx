"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Fuel, Zap, Leaf, Cloud, Droplets, LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  power: number;
  transmission: string;
  type: string;
};

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; isHybrid?: boolean; isElectric?: boolean }> = {
  'Essence': { icon: Fuel, color: "text-lime-400" },
  'Diesel': { icon: Fuel, color: "text-amber-400" },
  'Hybride essence': { icon: Fuel, color: "text-lime-400", isHybrid: true },
  'Hybride diesel': { icon: Fuel, color: "text-amber-400", isHybrid: true },
  'Électrique': { icon: Zap, color: "text-cyan-300", isElectric: true },
  'FlexFuel (Ethanol)': { icon: Leaf, color: "text-green-600" },
  'Gas naturel': { icon: Cloud, color: "text-slate-500" },
  'Hydrogène': { icon: Droplets, color: "text-blue-400" },
};

// Nom de l'événement personnalisé pour fermer les autres tooltips
const CLOSE_EVENT = "mcs-close-tooltips";

export default function Powertrain({ power, transmission, type }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ bottom: 0, left: 0 });
  
  const powerRef = useRef<HTMLSpanElement>(null); 
  
  const gearboxType = transmission.slice(-1);
  const gears = transmission.slice(0, -1);
  const config = TYPE_CONFIG[type] || { icon: Fuel, color: "text-slate-400" };
  const MainIcon = config.icon;

  const transmissionLabel = transmission === '1A' 
    ? "transmission à rapport unique" 
    : `boîte ${gearboxType === 'A' ? 'auto' : 'manuelle'} ${gears} rapports`;
  const fullDescription = `${type}, ${transmissionLabel}`;

  // Gestion des événements globaux
  useEffect(() => {
    const closeSelf = () => setShowTooltip(false);

    // Si ce tooltip est ouvert, on écoute les clics/scrolls pour le fermer
    if (showTooltip) {
        window.addEventListener("scroll", closeSelf, { capture: true });
        window.addEventListener("click", closeSelf);
        window.addEventListener("resize", closeSelf);

        // ÉCOUTEUR SPECIAL : Si un autre tooltip s'ouvre ailleurs, je me ferme
        window.addEventListener(CLOSE_EVENT, closeSelf);
    }

    return () => {
        window.removeEventListener("scroll", closeSelf, { capture: true });
        window.removeEventListener("click", closeSelf);
        window.removeEventListener("resize", closeSelf);
        window.removeEventListener(CLOSE_EVENT, closeSelf);
    };
  }, [showTooltip]);

  const updatePosition = () => {
    if (powerRef.current) {
        const rect = powerRef.current.getBoundingClientRect();
        
        // Calcul position Bottom
        const calculatedBottom = window.innerHeight - rect.top + 8;
        const calculatedLeft = rect.left + (rect.width / 2);

        setPosition({
            bottom: calculatedBottom,
            left: calculatedLeft
        });
    }
  };

  const toggleTooltip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Si c'est déjà ouvert, on ferme juste (toggle)
    if (showTooltip) {
        setShowTooltip(false);
        return;
    }

    // 1. On envoie un signal pour fermer TOUS les autres tooltips ouverts
    window.dispatchEvent(new Event(CLOSE_EVENT));
    
    // 2. On ouvre celui-ci
    updatePosition();
    setShowTooltip(true);
  };

  useLayoutEffect(() => {
      if (showTooltip) updatePosition();
  }, [showTooltip]);

  const renderFuelIcon = () => {
     if (config.isElectric) return <div className="w-5 h-5 flex items-center justify-center bg-blue-100 rounded-full shrink-0"><Zap size={14} className="text-blue-600 fill-blue-600" /></div>;
     if (config.isHybrid) return <div className="relative w-5 h-5 flex items-center justify-center shrink-0"><MainIcon size={16} className={config.color} strokeWidth={2.5} /><div className="absolute -bottom-1 -right-1 bg-blue-100 rounded-full p-[1px] shadow-sm border border-white"><Zap size={8} className="text-blue-600 fill-blue-600" /></div></div>;
     return <div className="w-5 h-5 flex items-center justify-center shrink-0"><MainIcon size={16} className={config.color} strokeWidth={2.5} /></div>;
  };

  const renderTransmissionIcon = () => {
    const isAuto = gearboxType === 'A';
    return <div className={cn("relative w-5 h-5 flex items-center justify-center bg-white text-slate-600 font-bold text-[10px] shadow-sm border border-slate-200 shrink-0", isAuto ? "rounded-full" : "rounded-sm")}>{gearboxType}<div className="absolute -bottom-1 -right-1 min-w-[10px] h-[10px] bg-blue-100 rounded-full flex items-center justify-center text-[7px] font-bold text-slate-800 shadow-sm px-[2px]">{gears}</div></div>;
  };

  return (
    <>
        <div className="relative inline-flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-md shadow-[0_1px_1px_rgba(0,0,0,0.02)] w-fit group">
        
            <div className="flex items-center justify-center">{renderFuelIcon()}</div>
            <div className="w-[1px] h-3 bg-slate-200/60"></div>

            <span 
                ref={powerRef} 
                className="font-bold font-mono text-xs tracking-tight text-slate-700 min-w-[40px] text-center"
            >
                {power}<span className="text-[9px] text-slate-400 ml-0.5 font-sans uppercase font-bold">ch</span>
            </span>
            
            <div className="w-[1px] h-3 bg-slate-200/60"></div>

            <div 
                onClick={toggleTooltip}
                className="cursor-help relative flex items-center justify-center p-0.5 -m-0.5 rounded hover:bg-slate-200/50 transition-colors"
            >
                {renderTransmissionIcon()}
            </div>

            <button
                onClick={toggleTooltip}
                className="absolute -top-1.5 -right-1.5 bg-white text-slate-400 hover:text-blue-600 border border-slate-200 rounded-full w-3.5 h-3.5 flex items-center justify-center shadow-sm z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            >
                <Info size={8} strokeWidth={3} />
            </button>
        </div>

        {showTooltip && typeof document !== "undefined" && createPortal(
            <AnimatePresence>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10, x: "-50%" }}
                    animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, scale: 0.9, x: "-50%" }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    style={{
                        position: "fixed",
                        bottom: position.bottom,
                        left: position.left,
                        zIndex: 9999,
                    }}
                    className="pointer-events-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[10px] font-medium px-3 py-2 rounded-lg shadow-2xl text-center leading-tight border border-slate-700/50 max-w-[200px]">
                        {fullDescription}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                    </div>
                </motion.div>
            </AnimatePresence>,
            document.body
        )}
    </>
  );
}