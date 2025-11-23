import { Fuel, Zap, Leaf, Cloud, Droplets, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  power: number;
  transmission: string;
  type: string;
};

// 1. TA CONFIGURATION EXACTE (Je n'ai rien touché)
const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; isHybrid?: boolean; isElectric?: boolean }> = {
  // --- CARBURANTS CLASSIQUES ---
  'Essence': { 
    icon: Fuel, 
    color: "text-lime-400" 
  },
  'Diesel': { 
    icon: Fuel, 
    color: "text-amber-400" 
  },

  // --- HYBRIDES ---
  'Hybride essence': { 
    icon: Fuel, 
    color: "text-lime-400", 
    isHybrid: true 
  },
  'Hybride diesel': { 
    icon: Fuel, 
    color: "text-amber-400", 
    isHybrid: true 
  },

  // --- ÉLECTRIQUE ---
  'Électrique': { 
    icon: Zap, 
    color: "text-cyan-300", 
    isElectric: true 
  },

  // --- ALTERNATIFS ---
  'FlexFuel (Ethanol)': { 
    icon: Leaf, 
    color: "text-green-600" 
  },
  'Gas naturel': { 
    icon: Cloud, 
    color: "text-slate-500" 
  },
  'Hydrogène': { 
    icon: Droplets, 
    color: "text-blue-400" 
  },
};

export default function Powertrain({ power, transmission, type }: Props) {
  // Parsing Transmission
  const gearboxType = transmission.slice(-1); // "A" ou "M"
  const gears = transmission.slice(0, -1);    // "1", "6", "8"...

  // Récupération de la config
  const config = TYPE_CONFIG[type] || { icon: Fuel, color: "text-slate-400" };
  const MainIcon = config.icon;

  // Rendu de l'icône Carburant (Logique conservée)
  const renderFuelIcon = () => {
    // CAS 1 : ÉLECTRIQUE PUR
    if (config.isElectric) {
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-blue-50 rounded-full shrink-0">
           <Zap size={16} className="text-blue-600 fill-blue-600" />
        </div>
      );
    }

    // CAS 2 : HYBRIDE
    if (config.isHybrid) {
      return (
        <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
          <MainIcon size={18} className={config.color} strokeWidth={2} />
          <div className="absolute -bottom-1 -right-1 bg-blue-50 rounded-full p-[1px] shadow-sm border border-slate-50">
            <Zap size={10} className="text-blue-600 fill-blue-600" />
          </div>
        </div>
      );
    }

    // CAS 3 : SIMPLE
    return (
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        <MainIcon size={18} className={config.color} strokeWidth={2} />
      </div>
    );
  };

  // Rendu de l'icône Transmission (NOUVELLE LOGIQUE)
  const renderTransmissionIcon = () => {
    const isAuto = gearboxType === 'A';
    
    return (
      <div className={cn(
        "relative w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-xs shadow-sm border border-slate-200 shrink-0",
        isAuto ? "rounded-full" : "rounded-md" // Rond pour Auto, Carré pour Méca
      )}>
        {gearboxType}
        
        {/* Badge nombre de rapports */}
        <div className="absolute -bottom-1.5 -right-1.5 min-w-[14px] h-[14px] bg-white rounded-full flex items-center justify-center text-[8px] font-black text-slate-900 border border-slate-200 shadow-sm px-0.5">
          {gears}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-3 text-slate-700">
      
      {/* 1. Icône Carburant */}
      <div title={type}>
        {renderFuelIcon()}
      </div>

      {/* 2. Puissance (Au centre) */}
      <span className="font-bold font-mono text-sm tracking-tight text-slate-900 min-w-[60px] text-center">
        {power}<span className="text-[10px] text-slate-400 ml-0.5 font-sans uppercase font-bold">ch</span>
      </span>

      {/* 3. Icône Transmission */}
      <div title={transmission === '1A' ? 'Boîte 1 rapport' : `Boîte ${gearboxType === 'A' ? 'Auto' : 'Manuelle'} ${gears} rapports`}>
        {renderTransmissionIcon()}
      </div>

    </div>
  );
}