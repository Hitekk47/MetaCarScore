import { getFuelIcon } from "@/lib/utils";

type Props = {
  power: number;
  transmission: string;
  type: string;
};

export default function Powertrain({ power, transmission, type }: Props) {
  // Parsing de la transmission (ex: "6A" -> "6", "A")
  const gearboxType = transmission.slice(-1); // "A" ou "M"
  const gears = transmission.slice(0, -1); // "6"

  return (
    <div className="flex items-center gap-2 text-slate-700">
      {/* Icone Carburant */}
      <span title={type} className="text-sm opacity-80 grayscale hover:grayscale-0 transition cursor-help">
        {getFuelIcon(type)}
      </span>

      {/* Puissance (Donnée principale) */}
      <span className="font-bold font-mono text-sm">
        {power}<span className="text-[10px] text-slate-400 ml-0.5 font-sans uppercase">ch</span>
      </span>

      {/* Séparateur discret */}
      <span className="text-slate-200 text-xs">|</span>

      {/* Boite de vitesse (Style Badge technique) */}
      <div className="flex items-baseline bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tighter border border-slate-200 text-slate-500 uppercase">
        <span>{gears}</span>
        <span className={gearboxType === 'A' ? 'text-blue-600' : 'text-orange-600'}>
          {gearboxType}
        </span>
      </div>
    </div>
  );
}