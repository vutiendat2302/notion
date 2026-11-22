"use client";

import { useEffect, useState } from "react";

import type { OutlineHeading } from "@/features/dashboards/canvas-utils";
import { cn } from "@/lib/utils";

export function OutlineRail({ headings }: { headings: OutlineHeading[] }) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(headings[0]?.blockId ?? null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const scrollRoot = document.getElementById("workspace-main-scroll");

    const computeActive = () => {
      const rootRect = scrollRoot?.getBoundingClientRect();
      const targetAnchorY = rootRect ? rootRect.top + rootRect.height * 0.25 : 180;

      let bestId = headings[0].blockId;
      let bestDist = Number.POSITIVE_INFINITY;

      for (const h of headings) {
        const el = document.querySelector(`[data-outline-block-id="${h.blockId}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top - targetAnchorY);
        if (rect.top <= targetAnchorY + 80 && dist < bestDist) {
          bestDist = dist;
          bestId = h.blockId;
        }
      }
      setActiveBlockId(bestId);
    };

    computeActive();
    const target: HTMLElement | Window = scrollRoot ?? window;
    target.addEventListener("scroll", computeActive, { passive: true });
    return () => target.removeEventListener("scroll", computeActive);
  }, [headings]);

  if (headings.length === 0) return null;

  function scrollToHeading(blockId: string) {
    const el = document.querySelector(`[data-outline-block-id="${blockId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveBlockId(blockId);
    }
  }

  return (
    <aside
      aria-label="Page outline"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed right-3 top-1/2 z-20 hidden -translate-y-1/2 md:flex"
    >
      <div className="relative flex flex-col items-end gap-2.5 rounded-xl py-2 pl-3 pr-1">
        {headings.map((h) => {
          const isActive = h.blockId === activeBlockId;
          const dashWidth = h.level === 1 ? "w-5" : h.level === 2 ? "w-3.5" : "w-2";
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => scrollToHeading(h.blockId)}
              aria-label={h.text}
              className="group/dash flex items-center justify-end py-0.5"
            >
              <span
                className={cn(
                  "block h-[2px] rounded-full transition-all duration-150",
                  dashWidth,
                  isActive
                    ? "w-6 bg-primary shadow-[0_0_8px_rgba(93,131,187,0.7)]"
                    : "bg-muted-foreground/40 group-hover/dash:bg-foreground"
                )}
              />
            </button>
          );
        })}

        {hovered && (
          <div className="absolute right-7 top-1/2 w-60 -translate-y-1/2 rounded-xl border border-border bg-card p-2.5 shadow-xl">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Outline
            </p>
            <div className="max-h-72 space-y-0.5 overflow-y-auto overscroll-contain">
              {headings.map((h) => {
                const isActive = h.blockId === activeBlockId;
                return (
                  <button
                    key={`card-${h.id}`}
                    type="button"
                    onClick={() => scrollToHeading(h.blockId)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-xs transition-colors",
                      h.level === 1 ? "pl-2 font-semibold" : h.level === 2 ? "pl-4 font-medium" : "pl-6 text-[11px]",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <span className="truncate">{h.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
