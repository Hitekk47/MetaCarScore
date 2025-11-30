import Header from "@/components/Header";
import { Scale, ShieldCheck, Calculator, Calendar, Split, Repeat, Info, LucideIcon, History  } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Méthodologie & Règles | MetaCarScore",
  description: "Comment sont calculés nos scores ? Découvrez nos règles de normalisation, de sélection des sources et de classification.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-12">
        
        {/* TITRE */}
        <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-4">
                <Info size={32} />
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">
                Notre Méthodologie
            </h1>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">
                La transparence est notre moteur. Voici les règles strictes qui régissent l'ajout de chaque essai dans notre base de données.
            </p>
        </div>

        {/* GRILLE BENTO */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. SOURCES */}
            <InfoCard 
                icon={ShieldCheck}
                color="blue"
                title="Sources Certifiées"
                content="Nous ne retenons que la presse automobile professionnelle. Aucun blogueur amateur, aucun avis utilisateur non vérifié. La crédibilité de la source est le premier filtre."
            />

            {/* 2. NORMALISATION */}
            <InfoCard 
                icon={Scale}
                color="emerald"
                title="Normalisation Universelle"
                content="5 étoiles, 20/20, ou système allemand (Note 1 = Excellent) : nous convertissons chaque système de notation en un Score Base 100 mathématiquement équivalent."
            />

            {/* 3. CALCUL */}
            <InfoCard 
                icon={Calculator}
                color="slate"
                title="Moyenne Pure"
                content="Aucune pondération obscure. Le MetaCarScore est une moyenne arithmétique stricte. L'avis d'un magazine local vaut autant que celui d'un géant international."
            />

            {/* 4. RÈGLE DES 3 */}
            <div className="md:col-span-2 lg:col-span-2 bg-slate-900 text-white p-8 rounded-2xl shadow-lg flex flex-col justify-center">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-4 flex items-center gap-3">
                    <span className="w-8 h-8 bg-white/10 rounded flex items-center justify-center text-orange-400 font-serif font-bold">3</span>
                    La Règle de Fiabilité
                </h3>
                <p className="text-slate-300 leading-relaxed">
                    Pour éviter les biais d'un testeur isolé, nous n'affichons aucun score global (MetaCarScore) tant qu'un véhicule n'a pas reçu <strong>au moins 3 essais distincts</strong>. En dessous, le score reste confidentiel.
                </p>
            </div>

            {/* 5. ANNEE MODELE */}
            <InfoCard 
                icon={Calendar}
                color="indigo"
                title="L'Année Modèle (MY)"
                content="Un nouveau millésime est créé uniquement lors d'un changement majeur (nouvelle plateforme) ou d'un restylage visible (pare-chocs, habitacle). Les mises à jour logicielles (ex: Tesla) ou incrémentales légères ne créent pas de nouveau millésime."
            />

            {/* 6. MODELE VS FINITION */}
            <InfoCard 
                icon={Split}
                color="amber"
                title="Modèle ou Finition ?"
                content="Nous suivons la hiérarchie constructeur. Si la carrosserie change, c'est un modèle. Sinon, c'est une finition. Ex: 'John Cooper Works' est une finition selon Mini, pas un modèle à part."
            />
            <div className="md:col-span-2 lg:col-span-1 bg-slate-50 border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center shrink-0">
                        <History size={18} />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-tight text-slate-900">
                        Périmètre Temporel
                    </h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                    La collecte des données MetaCarScore a débuté en <strong>Juillet 2019</strong>. Les véhicules dont la carrière s'est arrêtée avant cette date sont absents ou incomplets, faute d'essais contemporains numérisés et compatibles avec nos critères.
                </p>
            </div>
            {/* 7. DOUBLONS (Pourquoi plusieurs essais ?) */}
            <div className="md:col-span-2 lg:col-span-3 bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                        <Repeat size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold uppercase tracking-tight text-slate-900 mb-4">
                            Pourquoi plusieurs essais d'une même source ?
                        </h3>
                        <p className="text-slate-500 mb-4">
                            Il arrive qu'un même média (ex: Top Gear) apparaisse plusieurs fois pour un même véhicule. C'est normal et voulu dans les cas suivants :
                        </p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium text-slate-700">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                                Motorisation ou transmission différente.
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                                Finition différente.
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 shrink-0"></span>
                                Écart de note significatif (&gt; 2 points) sur un re-test. (Cela arrive souvent lors d'un duel ou d'un comparatif postérieur).
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 shrink-0"></span>
                                <span>
                                    Précision de la finition : Un second essai est ajouté uniquement s'il vient préciser la finition d'une première prise en main générique datant de plus d'un an.
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}

// SOUS-COMPOSANT CARTE
function InfoCard({ icon: Icon, color, title, content }: { icon: LucideIcon, color: string, title: string, content: string }) {
    const colorClasses: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600",
        emerald: "bg-emerald-50 text-emerald-600",
        slate: "bg-slate-100 text-slate-600",
        indigo: "bg-indigo-50 text-indigo-600",
        amber: "bg-amber-50 text-amber-600",
    };

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", colorClasses[color])}>
                <Icon size={20} />
            </div>
            <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{content}</p>
        </div>
    );
}