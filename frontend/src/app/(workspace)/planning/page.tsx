"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { PeriodType } from "@/types/domain";

const HORIZONS: { type: PeriodType; label: string; sampleKey: string }[] = [
  { type: "YEAR", label: "Year", sampleKey: "2026" },
  { type: "QUARTER", label: "Quarter", sampleKey: "2026-Q4" },
  { type: "MONTH", label: "Month", sampleKey: "2026-11" },
  { type: "WEEK", label: "Week", sampleKey: "2026-W47" },
  { type: "DAY", label: "Day", sampleKey: "2026-11-19" },
];

export default function PlanningPage() {
  const [selected, setSelected] = useState<PeriodType>("WEEK");
  const current = HORIZONS.find((h) => h.type === selected) ?? HORIZONS[3];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Planning Horizons
          </h1>
          <p className="text-sm text-muted-foreground">
            Year → Quarter → Month → Week → Day scopes without duplicating tasks.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {HORIZONS.map((horizon) => (
            <button
              key={horizon.type}
              type="button"
              onClick={() => setSelected(horizon.type)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                selected === horizon.type
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {horizon.label}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-primary">
              {current.type} SCOPE
            </span>
            <h2 className="mt-0.5 font-mono text-lg font-semibold text-foreground">
              {current.sampleKey}
            </h2>
          </div>
          <span className="rounded-md bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            Phase BE-3 Target
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Saved Plan focus, pinned commitments (<code>plan_items</code>), and period rollover preview will connect to{" "}
          <code>/api/v1/planning/periods/{current.type}/{current.sampleKey}</code>.
        </p>
      </section>
    </div>
  );
}
