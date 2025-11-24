import { Fuel, Zap, Leaf, Cloud, Droplets, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  power: number;
  transmission: string;
  type: string;
};

// CONFIGURATION (Inchangée)
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

export default function Powertrain({ power, transmission, type }: Props) {
  const gearboxType = transmission.slice(-1);
  const gears = transmission.slice(0, -1);
  const config = TYPE_CONFIG[type] || { icon: Fuel, color: "text-slate-400" };
  const MainIcon = config.icon;

  const renderFuelIcon = () => {
    if (config.isElectric) {
      return (
        <div className="w-5 h-5 flex items-center justify-center bg-blue-100 rounded-full shrink-0">
           <Zap size={14} className="text-blue-600 fill-blue-600" />
        </div>
      );
    }
    if (config.isHybrid) {
      return (
        <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
          <MainIcon size={16} className={config.color} strokeWidth={2.5} />
          <div className="absolute -bottom-1 -right-1 bg-blue-100 rounded-full p-[1px] shadow-sm border border-white">
            <Zap size={8} className="text-blue-600 fill-blue-600" />
          </div>
        </div>
      );
    }
    return (
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        <MainIcon size={16} className={config.color} strokeWidth={2.5} />
      </div>
    );
  };

  const renderTransmissionIcon = () => {
    const isAuto = gearboxType === 'A';
    return (
      <div className={cn(
        "relative w-5 h-5 flex items-center justify-center bg-white text-slate-600 font-bold text-[10px] shadow-sm border border-slate-200 shrink-0",
        isAuto ? "rounded-full" : "rounded-sm"
      )}>
        {gearboxType}
        <div className="absolute -bottom-1 -right-1 min-w-[10px] h-[10px] bg-blue-100 rounded-full flex items-center justify-center text-[7px] font-bold text-slate-800 shadow-sm px-[2px]">
          {gears}
        </div>
      </div>
    );
  };

  return (
    // CONTENEUR "CAPSULE" RECTANGULAIRE
    <div className="inline-flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-md shadow-[0_1px_1px_rgba(0,0,0,0.02)] w-fit">
      
      {/* 1. Énergie */}
      <div title={type} className="flex items-center justify-center">
        {renderFuelIcon()}
      </div>

      {/* Séparateur subtil */}
      <div className="w-[1px] h-3 bg-slate-200/60"></div>

      {/* 2. Puissance */}
      <span className="font-bold font-mono text-xs tracking-tight text-slate-700 min-w-[50px] text-center">
        {power}<span className="text-[9px] text-slate-400 ml-0.5 font-sans uppercase font-bold">ch</span>
      </span>

      {/* Séparateur subtil */}
      <div className="w-[1px] h-3 bg-slate-200/60"></div>

      {/* 3. Boîte */}
      <div title={transmission === '1A' ? 'Boîte 1 rapport' : `Boîte ${gearboxType === 'A' ? 'Auto' : 'Manuelle'} ${gears} rapports`}>
        {renderTransmissionIcon()}
      </div>

    </div>
  );
}