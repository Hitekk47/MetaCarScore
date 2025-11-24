import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type Props = {
  marque: string;
  famille?: string;
  my?: string;
  modele?: string;
  powertrain?: string;
};

export default function SmartBreadcrumb({ marque, famille, my, modele, powertrain }: Props) {
  
  // Helper : On extrait juste la puissance pour l'arborescence
  const formatPowertrain = (slug: string) => {
    // Format attendu : Type_Puissance_Transmission (ex: Essence_525_7A)
    const parts = slug.split('_');
    // La puissance est l'avant-dernier élément (parts.length - 2)
    // car le type peut contenir des underscores, mais la structure finale est fixe
    if (parts.length >= 2) {
        const power = parts[parts.length - 2];
        return `${power} ch`;
    }
    return slug;
  };

  return (
    <div className="flex items-center flex-wrap gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-8">
      
      <Link href="/" className="hover:text-white transition flex items-center gap-1">
        <Home size={12} /> Accueil
      </Link>
      
      {/* ... (MARQUE, FAMILLE, MY inchangés) ... */}
      
      {/* 1. MARQUE */}
      {marque && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {famille ? (
             <span className="hover:text-slate-300 transition cursor-default">{marque}</span>
          ) : <span className="text-white">{marque}</span>}
        </>
      )}

      {/* 2. FAMILLE */}
      {famille && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {my ? (
            <Link href={`/${marque}/${famille}`} className="hover:text-white transition text-slate-500">{famille}</Link>
          ) : <span className="text-white">{famille}</span>}
        </>
      )}

      {/* 3. MY */}
      {my && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {modele ? (
            <Link href={`/${marque}/${famille}/${my}`} className="hover:text-white transition text-slate-500">MY {my}</Link>
          ) : <span className="text-white">MY {my}</span>}
        </>
      )}

      {/* 4. MODÈLE (Devient un lien si Powertrain existe) */}
      {modele && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {powertrain ? (
            <Link href={`/${marque}/${famille}/${my}/${modele}`} className="hover:text-white transition text-slate-500">{modele}</Link>
          ) : <span className="text-white">{modele}</span>}
        </>
      )}

      {/* 5. POWERTRAIN (Juste la puissance) */}
      {powertrain && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          <span className="text-white truncate max-w-[150px]">{formatPowertrain(powertrain)}</span>
        </>
      )}

    </div>
  );
}