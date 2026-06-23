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
 * Dictionary mapping normalized magazine names to their ISO 3166-1 alpha-2 country codes.
 * Keys MUST be lowercase and normalized via normalizeSourceName.
 * Codes MUST be lowercase for flag-icons CSS compatibility.
 */
export const magazineCountries: Record<string, string> = {
  // --- France 🇫🇷 ---
  "auto moto": "fr",
  "auto plus": "fr",
  "auto plus crossovers": "fr",
  "auto plus crossovers suv": "fr",
  "electricar": "fr",
  "l'auto-journal": "fr",
  "l'auto-journal 4x4": "fr",
  "l'automobile magazine": "fr",
  "l'automobile nouvelles énergies": "fr",
  "moove": "fr",
  "motorsport": "fr",
  "sport auto france": "fr",
  "top's cars": "fr",

  // --- Germany 🇩🇪 ---
  "autostraßenverkehr": "de",
  "auto bild": "de",
  "auto bild allrad": "de",
  "auto bild sportscars": "de",
  "auto motor & sport": "de",
  "auto motor und sport": "de",
  "auto test": "de",
  "auto zeitung": "de",
  "electric drive": "de",
  "grip": "de",
  "suv magazin": "de",
  "sport auto": "de",

  // --- United Kingdom 🇬🇧 ---
  "auto express": "gb",
  "autocar": "gb",
  "car magazine": "gb",
  "diesel & eco car": "gb",
  "diesel car & eco car": "gb",
  "evo": "gb",
  "the intercooler": "gb",
  "top gear": "gb",
  "what car?": "gb",

  // --- United States 🇺🇸 ---
  "car and driver": "us",
  "consumer reports": "us",

  // --- Italy 🇮🇹 ---
  "auto it": "it",
  "quattroruote": "it",
  "quattrouote": "it", // Typo in DB

  // --- Spain 🇪🇸 ---
  "altagama coches": "es",
  "autopista": "es",
  "coches": "es",

  // --- Sweden 🇸🇪 ---
  "elbilen": "se",
  "m3 motor": "se",
  "teknikens värld": "se",
  "vi bilägare": "se",

  // --- Austria 🇦🇹 ---
  "alles auto": "at",

  // --- Switzerland 🇨🇭 ---
  "auto-illustrierte": "ch",

  // --- Australia 🇦🇺 ---
  "motor": "au",
  "wheels": "au",

  // --- Luxembourg 🇱🇺 ---
  "drivenation": "lu",

  // --- Russia 🇷🇺 ---
  "auto review": "ru",

  // --- Unverified Sources 🌐 ---
  // Mapping for sources where the country is not definitively known or verified.
};
