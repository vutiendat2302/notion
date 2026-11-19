"use client";

import { Check } from "lucide-react";

import { ACCENT_DOT_CLASSES, cn, formatMinutes, PRIORITY_LABELS } from "@/lib/utils";
import type { Category, OccurrenceWithTask, Project } from "@/types/domain";

interface TaskRowProps {
  item: OccurrenceWithTask;
  category?: Category;
  project?: Project;
  onToggleComplete: (item: OccurrenceWithTask) => void;
  onSelect: (item: OccurrenceWithTask) => void;
}

export function TaskRow({
  item,
  category,
  project,
  onToggleComplete,
  onSelect,
}: TaskRowProps) {
  const isDone = item.status === "DONE";

  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 transition-colors duration-150 hover:bg-secondary/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={() => onToggleComplete(item)}
          aria-label={isDone ? `Reopen ${item.task.title}` : `Complete ${item.task.title}`}
          aria-pressed={isDone}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 bg-background hover:border-primary"
          )}
        >
          {isDone && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={() => onSelect(item)}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={cn(
              "truncate text-sm font-medium",
              isDone ? "text-muted-foreground line-through" : "text-foreground"
            )}
          >
            {item.task.title}
          </p>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        {category && (
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span
              className={cn("h-2 w-2 rounded-full", ACCENT_DOT_CLASSES[category.accent_token])}
              aria-hidden="true"
            />
            <span>{category.name}</span>
          </span>
        )}
        {project && (
          <span className="hidden rounded-md bg-secondary px-2 py-0.5 md:inline">
            {project.title}
          </span>
        )}
        {item.estimated_minutes && (
          <span className="font-mono tabular-nums">
            {formatMinutes(item.estimated_minutes)}
          </span>
        )}
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px]">
          {PRIORITY_LABELS[item.task.priority]}
        </span>
      </div>
    </div>
  );
}
