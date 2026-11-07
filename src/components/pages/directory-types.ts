import { Trophy, Zap, Leaf, Fuel, Cog, LayoutGrid, Layers, Luggage, Sun, type LucideIcon } from "lucide-react";
import type { FamilySegment } from "@/lib/types";

export const DIRECTORY_ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,
  zap: Zap,
  leaf: Leaf,
  fuel: Fuel,
  cog: Cog,
  grid: LayoutGrid,
  layers: Layers,
  luggage: Luggage,
  sun: Sun,
};

export type DirectoryItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  iconName?: keyof typeof DIRECTORY_ICONS;
  letter?: string;
  colorClass?: string;
  isAlias?: boolean;
  canonicalMarque?: string | null;
  canonicalFamille?: string | null;
  latestMy?: number | null;
  segments?: FamilySegment[];
};
