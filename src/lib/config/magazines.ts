/**
 * Normalizes a source name for consistent dictionary lookups.
 * Strips invisible characters (soft hyphens, zero-width spaces), trims, and lowercases.
 */
export const normalizeSourceName = (name: string): string => {
  if (!name) return "";
  return name
    .replace(/[\u00AD\u200B]/g, "") // Strip invisible characters
    .trim()
    .toLowerCase();
};

/**
 * Dictionary mapping normalized magazine names to their country flag emojis.
 * Keys MUST be lowercase and normalized via normalizeSourceName.
 */
export const magazineCountries: Record<string, string> = {
  // --- France 🇫🇷 ---
  "auto moto": "🇫🇷",
  "auto plus": "🇫🇷",
  "auto plus crossovers": "🇫🇷",
  "auto plus crossovers suv": "🇫🇷",
  "electricar": "🇫🇷",
  "l'auto-journal": "🇫🇷",
  "l'auto-journal 4x4": "🇫🇷",
  "l'automobile magazine": "🇫🇷",
  "l'automobile nouvelles énergies": "🇫🇷",
  "moove": "🇫🇷",
  "motorsport": "🇫🇷",
  "sport auto france": "🇫🇷",
  "top's cars": "🇫🇷",

  // --- Germany 🇩🇪 ---
  "autostraßenverkehr": "🇩🇪",
  "auto bild": "🇩🇪",
  "auto bild allrad": "🇩🇪",
  "auto bild sportscars": "🇩🇪",
  "auto motor & sport": "🇩🇪",
  "auto motor und sport": "🇩🇪",
  "auto test": "🇩🇪",
  "auto zeitung": "🇩🇪",
  "electric drive": "🇩🇪",
  "grip": "🇩🇪",
  "suv magazin": "🇩🇪",
  "sport auto": "🇩🇪",

  // --- United Kingdom 🇬🇧 ---
  "auto express": "🇬🇧",
  "autocar": "🇬🇧",
  "car magazine": "🇬🇧",
  "diesel & eco car": "🇬🇧",
  "diesel car & eco car": "🇬🇧",
  "evo": "🇬🇧",
  "the intercooler": "🇬🇧",
  "top gear": "🇬🇧",
  "what car?": "🇬🇧",

  // --- United States 🇺🇸 ---
  "car and driver": "🇺🇸",
  "consumer reports": "🇺🇸",

  // --- Italy 🇮🇹 ---
  "auto it": "🇮🇹",
  "quattroruote": "🇮🇹",
  "quattrouote": "🇮🇹", // Typo in DB

  // --- Spain 🇪🇸 ---
  "altagama coches": "🇪🇸",
  "autopista": "🇪🇸",
  "coches": "🇪🇸",

  // --- Sweden 🇸🇪 ---
  "elbilen": "🇸🇪",
  "m3 motor": "🇸🇪",
  "teknikens värld": "🇸🇪",
  "vi bilägare": "🇸🇪",

  // --- Austria 🇦🇹 ---
  "alles auto": "🇦🇹",

  // --- Switzerland 🇨🇭 ---
  "auto-illustrierte": "🇨🇭",

  // --- Australia 🇦🇺 ---
  "motor": "🇦🇺",
  "wheels": "🇦🇺",

  // --- Luxembourg 🇱🇺 ---
  "drivenation": "🇱🇺",

  // --- Russia 🇷🇺 ---
  "auto review": "🇷🇺",

  // --- Unverified Sources ---
  // The following sources need verification of their primary country.
  // Currently mapped to 🌐 by fallback in the component.
};
