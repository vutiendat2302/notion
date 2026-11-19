import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { AccentToken, TaskPriority } from "@/types/domain";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "0m";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatElapsedSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export const ACCENT_DOT_CLASSES: Record<AccentToken, string> = {
  LAVENDER: "bg-[var(--category-lavender)]",
  SAGE: "bg-[var(--category-sage)]",
  PEACH: "bg-[var(--category-peach)]",
  ROSE: "bg-[var(--category-rose)]",
  BUTTER: "bg-[var(--category-butter)]",
  SKY: "bg-[var(--category-sky)]",
  SLATE: "bg-[var(--muted-foreground)]",
};

export const ACCENT_PILL_STYLES: Record<AccentToken, string> = {
  LAVENDER: "bg-[var(--category-lavender-soft)] text-[var(--category-lavender-text)]",
  SAGE: "bg-[var(--category-sage-soft)] text-[var(--category-sage-text)]",
  PEACH: "bg-[var(--category-peach-soft)] text-[var(--category-peach-text)]",
  ROSE: "bg-[var(--category-rose-soft)] text-[var(--category-rose-text)]",
  BUTTER: "bg-[var(--category-butter-soft)] text-[var(--category-butter-text)]",
  SKY: "bg-[var(--category-sky-soft)] text-[var(--category-sky-text)]",
  SLATE: "bg-secondary text-muted-foreground",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};
