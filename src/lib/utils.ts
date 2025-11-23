import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getScoreColor = (score: number) => {
  // > 75 : VERT
  if (score >= 75) {
    return { 
      bg: "bg-score-good", 
      text: "text-black", 
      border: "border-score-good", 
      light: "bg-score-good/10" 
    };
  }
  
  // > 50 : JAUNE
  if (score >= 50) {
    return { 
      bg: "bg-score-mixed", 
      text: "text-black", 
      border: "border-score-mixed", 
      light: "bg-score-mixed/10" 
    };
  }

  // < 50 : ROUGE
  return { 
    bg: "bg-score-bad", 
    text: "text-white", 
    border: "border-score-bad", 
    light: "bg-score-bad/10" 
  };
};