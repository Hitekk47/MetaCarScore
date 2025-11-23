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