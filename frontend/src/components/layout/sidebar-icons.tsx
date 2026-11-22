"use client";

import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarRange,
  CheckSquare,
  Clock,
  Compass,
  FileText,
  Flame,
  FolderKanban,
  Heart,
  Home,
  Layers,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { createElement } from "react";
import { resolveMediaUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export const PRESET_SIDEBAR_ICONS: ReadonlyArray<{ key: string; Icon: LucideIcon }> = [
  { key: "Timer", Icon: Timer },
  { key: "FileText", Icon: FileText },
  { key: "LayoutDashboard", Icon: LayoutDashboard },
  { key: "Sun", Icon: Sun },
  { key: "ListTodo", Icon: ListTodo },
  { key: "CheckSquare", Icon: CheckSquare },
  { key: "Calendar", Icon: Calendar },
  { key: "CalendarRange", Icon: CalendarRange },
  { key: "FolderKanban", Icon: FolderKanban },
  { key: "Target", Icon: Target },
  { key: "BarChart3", Icon: BarChart3 },
  { key: "Flame", Icon: Flame },
  { key: "Sparkles", Icon: Sparkles },
  { key: "BookOpen", Icon: BookOpen },
  { key: "Briefcase", Icon: Briefcase },
  { key: "Clock", Icon: Clock },
  { key: "Compass", Icon: Compass },
  { key: "Heart", Icon: Heart },
  { key: "Home", Icon: Home },
  { key: "Layers", Icon: Layers },
  { key: "Lightbulb", Icon: Lightbulb },
  { key: "Star", Icon: Star },
  { key: "Tag", Icon: Tag },
  { key: "Trophy", Icon: Trophy },
];

const ICON_MAP = new Map(PRESET_SIDEBAR_ICONS.map((item) => [item.key, item.Icon]));

export function SidebarItemIcon({
  iconType,
  iconValue,
  className,
}: {
  iconType: "preset" | "upload";
  iconValue: string;
  className?: string;
}) {
  if (iconType === "upload" && iconValue) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={resolveMediaUrl(iconValue)}
        alt=""
        className={cn("h-4 w-4 shrink-0 rounded object-cover", className)}
      />
    );
  }
  return createElement(ICON_MAP.get(iconValue) ?? FileText, {
    className: cn("h-4 w-4 shrink-0", className),
    "aria-hidden": true,
  });
}
