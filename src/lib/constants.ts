export const TOPS_MENU = [
  {
    id: "marques",
    title: "Top Marques",
    href: "/tops/marques",
    priority: 0.9
  },
  {
    id: "general",
    title: "Top 100 Général",
    href: "/tops/modeles",
    priority: 0.9
  },
  {
    id: "breaks",
    title: "Meilleurs Breaks",
    href: "/tops/breaks",
    priority: 0.9
  },
  {
    id: "manual",
    title: "Boîte Manuelle",
    href: "/tops/manuelle",
    priority: 0.9
  },
  {
    id: "ev",
    title: "Top Électriques",
    href: "/tops/electrique",
    priority: 0.9
  },
  {
    id: "diesel",
    title: "Top Diesel",
    href: "/tops/diesel",
    priority: 0.9
  },
  {
    id: "petrol",
    title: "Top Essence",
    href: "/tops/essence",
    priority: 0.9
  },
  {
    id: "phev",
    title: "Top Hybrides",
    href: "/tops/hybride",
    priority: 0.9
  },
  {
    id: "convertible",
    title: "Top Découvrables",
    href: "/tops/decouvrables",
    priority: 0.9
  },

];

export type SegmentDef = { code: string; label: string };

export const MACRO_CONFIG: { label: string; segments: SegmentDef[] }[] = [
  {
    label: "Berline / Hatch",
    segments: [
      { code: "A", label: "Micro-Citadines" },  // Twingo, Panda
      { code: "B", label: "Citadines" },        // Clio, 208
      { code: "C", label: "Compactes" },        // Golf, 308
      { code: "D", label: "Berlines Familiales" }, // Passat, Model 3
      { code: "E", label: "Routières / Luxe" }, // Série 5, Classe E
      { code: "F", label: "Limousines" }        // Série 7, Classe S
    ]
  },
  {
    label: "SUV / Crossover",
    segments: [
      { code: "A", label: "Micro-SUV" },     // Ignis
      { code: "B", label: "SUV Urbains" },   // 2008, Captur
      { code: "C", label: "SUV Compacts" },  // 3008, Tiguan
      { code: "D", label: "SUV Familiaux" }, // X3, GLC
      { code: "E", label: "Grands SUV Luxe" }, // X5, Cayenne
      { code: "F", label: "SUV Prestige" }   // Range Rover, Bentayga
    ]
  },
  {
    label: "Sport / Coupé / Cab",
    segments: [
      { code: "SPORT", label: "Sportives Light" }, // MX-5, Alpine
      { code: "GT", label: "Grand Tourisme" },     // 911, AMG GT
      { code: "SUPER", label: "Supercars" }        // Ferrari, McLaren
    ]
  },
  {
    label: "Familiale / Van",
    segments: [
      { code: "B", label: "Ludospaces" },          // Kangoo, Berlingo
      { code: "C", label: "Monospaces Compacts" }, // Scénic, Touran
      { code: "D", label: "Grands Monospaces" },   // Espace, Sharan
      { code: "E", label: "Vans VIP / Navettes" }  // Classe V, Multivan
    ]
  },
  {
    label: "Utilitaire / Pickup",
    segments: [
      { code: "C", label: "Compact / City" },    // Kangoo, Caddy
      { code: "D", label: "Moyen / 1 Tonne" },     // Ranger, Hilux, Amarok, Trafic
      { code: "E", label: "Grand / Full Size" }    // F-150, RAM, Crafter
    ]
  }
];

export const SEARCH_PLACEHOLDERS = [
  "Trouvez le score de n'importe quel véhicule...",
  "Ex : Porsche 911, Tesla Model Y, Peugeot 3008...",
  "Recherchez une marque ou un modèle...",
];
