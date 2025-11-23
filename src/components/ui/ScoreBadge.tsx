import { getScoreColor } from "@/lib/utils";

export default function ScoreBadge({ score, size = "md" }: { score: number, size?: "sm" | "md" | "lg" | "xl" }) {
  const colors = getScoreColor(score);
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-lg",
    lg: "w-20 h-20 text-3xl",
    xl: "w-32 h-32 text-5xl",
  };

  return (
    <div className={`
      ${sizeClasses[size]} 
      ${colors.bg} 
      rounded flex items-center justify-center 
      font-black text-white shadow-sm shrink-0
    `}>
      {score}
    </div>
  );
}