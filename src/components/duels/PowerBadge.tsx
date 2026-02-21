import { Gauge } from "lucide-react";

type PowerBadgeProps = {
  text: string | null;
};

export default function PowerBadge({ text }: PowerBadgeProps) {
    if (!text) return null;
    return (
        <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-slate-500 whitespace-nowrap">
            <Gauge size={10} className="text-slate-400" />
            {text}
        </div>
    );
}
