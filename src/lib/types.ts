export type Review = {
  supabase_id: number;
  MY: number; // Model Year
  Marque: string;
  Famille: string;
  Modele: string;
  Puissance: number;
  // Liste exhaustive des 8 types
  Type: 
    | 'Essence' 
    | 'Diesel' 
    | 'Hybride Essence' 
    | 'Hybride diesel' 
    | 'Électrique' 
    | 'FlexFuel (Ethanol)' 
    | 'Gas naturel' 
    | 'Hydrogène';
  Transmission: string; // ex: "1A", "6M", "7A"
  Finition: string | null;
  Testeur: string;
  Test_date: string; // Format YYYY/MM
  Score: number;
};

export type AggregatedSource = {
  sourceName: string;
  avgScore: number;
  count: number;
  rawScores: number[];
};

export type SearchResult = {
  Marque: string;
  Famille: string;
  Modele: string | null;
  Type: 'family' | 'model';
  MaxMY: number | null;
};

export type ModelRankingItem = {
  Marque: string;
  Famille: string;
  MY: number;
  Modele: string;
  avg_score: number;
  review_count: number;
  segment_size?: string;
  macro_category?: string;
};

export type BrandRankingItem = {
  brand: string;
  avg_score: number;
  review_count: number;
  best_model: string | null;
  best_score: number | null;
  best_famille: string | null;
  best_my: number | null;
  worst_model: string | null;
  worst_score: number | null;
  worst_famille: string | null;
  worst_my: number | null;
};
