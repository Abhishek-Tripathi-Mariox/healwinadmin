// src/types/index.ts
import type { LucideIcon } from "lucide-react";

export interface Stat {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color: string;
}

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
}
