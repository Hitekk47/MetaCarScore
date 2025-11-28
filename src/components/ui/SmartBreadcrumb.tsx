import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { toSlug } from "@/lib/slugify";

type Props = {
  marque: string;
  famille?: string;
  my?: string;
  modele?: string;
  powertrain?: string;
};

export default function SmartBreadcrumb({ marque, famille, my, modele, powertrain }: Props) {
  
  const formatPowertrain = (slug: string) => {
    const parts = slug.split('_');
    if (parts.length >= 2) {
        const power = parts[parts.length - 2];
        return `${power} ch`;
    }
    return slug;
  };

  return (
    <div className="flex items-center flex-wrap gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-8">
      
      {/* ACCUEIL */}
      <Link href="/" className="hover:text-white transition flex items-center gap-1">
        <Home size={12} /> Accueil
      </Link>
      
      {/* 1. MARQUE */}
      {marque && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {famille ? (
             // MODIFICATION ICI : C'est maintenant un LIEN vers la bibliothèque de la marque
             <Link 
                href={`/${toSlug(marque)}`} 
                className="hover:text-white transition text-slate-500"
             >
                {marque}
             </Link>
          ) : (
             // Si on est déjà sur la page Marque, c'est du texte blanc
             <span className="text-white">{marque}</span>
          )}
        </>
      )}

      {/* 2. FAMILLE */}
      {famille && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {my ? (
            <Link href={`/${toSlug(marque)}/${toSlug(famille)}`} className="hover:text-white transition text-slate-500">{famille}</Link>
          ) : <span className="text-white">{famille}</span>}
        </>
      )}

      {/* 3. MY */}
      {my && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {modele ? (
            <Link href={`/${toSlug(marque)}/${toSlug(famille)}/${my}`} className="hover:text-white transition text-slate-500">MY {my}</Link>
          ) : <span className="text-white">MY {my}</span>}
        </>
      )}

      {/* 4. MODÈLE */}
      {modele && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          {powertrain ? (
            <Link href={`/${toSlug(marque)}/${toSlug(famille)}/${my}/${toSlug(modele)}`} className="hover:text-white transition text-slate-500">{modele}</Link>
          ) : <span className="text-white">{modele}</span>}
        </>
      )}

      {/* 5. POWERTRAIN */}
      {powertrain && (
        <>
          <ChevronRight size={10} className="text-slate-600" />
          <span className="text-white truncate max-w-[150px]">{formatPowertrain(powertrain)}</span>
        </>
      )}

    </div>
  );
}