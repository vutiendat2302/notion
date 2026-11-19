"use client";

import { X } from "lucide-react";

import { formatMinutes, PRIORITY_LABELS } from "@/lib/utils";
import type { OccurrenceWithTask } from "@/types/domain";

interface TaskDetailPanelProps {
  item: OccurrenceWithTask | null;
  onClose: () => void;
}

export function TaskDetailPanel({ item, onClose }: TaskDetailPanelProps) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/25"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Task Details"
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Occurrence · {item.recurrence_key}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {item.task.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
            <div>
              <span className="block text-xs text-muted-foreground">Status</span>
              <span className="font-medium text-foreground">{item.status}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Priority</span>
              <span className="font-medium text-foreground">
                {PRIORITY_LABELS[item.task.priority]}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Scheduled Date</span>
              <span className="font-mono text-xs text-foreground">
                {item.scheduled_date ?? "Unscheduled (Inbox)"}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Estimate</span>
              <span className="font-mono text-xs text-foreground">
                {item.estimated_minutes ? formatMinutes(item.estimated_minutes) : "—"}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Description</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
              {item.task.description || "No description provided."}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
