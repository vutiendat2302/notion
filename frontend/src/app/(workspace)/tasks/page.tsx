"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  completeOccurrence,
  createTask,
  fetchCategories,
  fetchOccurrences,
  fetchProjects,
  reopenOccurrence,
} from "@/features/tasks/api";
import { QuickAddTask } from "@/features/tasks/quick-add-task";
import { TaskDetailPanel } from "@/features/tasks/task-detail-panel";
import { TaskRow } from "@/features/tasks/task-row";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { Category, OccurrenceWithTask, Project } from "@/types/domain";

const SCOPES = ["inbox", "today", "upcoming", "all", "completed"] as const;

const SCOPE_LABELS: Record<(typeof SCOPES)[number], string> = {
  inbox: "Inbox",
  today: "Today",
  upcoming: "Upcoming",
  all: "All",
  completed: "Completed",
};

function TasksWorkspaceContent() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useQueryState(
    "scope",
    parseAsStringLiteral(SCOPES).withDefault("inbox")
  );
  const [selectedItem, setSelectedItem] = useState<OccurrenceWithTask | null>(null);

  const occurrencesQuery = useQuery({
    queryKey: ["occurrences", scope],
    queryFn: () => fetchOccurrences(scope),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    retry: false,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    retry: false,
  });

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categoriesQuery.data ?? []) map.set(c.id, c);
    return map;
  }, [categoriesQuery.data]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projectsQuery.data ?? []) map.set(p.id, p);
    return map;
  }, [projectsQuery.data]);

  const createMutation = useMutation({
    mutationFn: (title: string) => createTask({ title }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["occurrences"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: OccurrenceWithTask) => {
      if (item.status === "DONE") {
        return reopenOccurrence(item.id);
      }
      return completeOccurrence(item.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["occurrences"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update occurrence");
    },
  });

  const items = occurrencesQuery.data?.items ?? [];
  const isUnauthorized =
    occurrencesQuery.error instanceof ApiClientError &&
    occurrencesQuery.error.status === 401;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tasks
          </h1>
          <p className="text-sm text-muted-foreground">
            One Task definition, tracked cleanly per occurrence.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {SCOPES.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => void setScope(tab)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                scope === tab
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {SCOPE_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <QuickAddTask
        placeholder="Capture task to Inbox (title-only)..."
        isSubmitting={createMutation.isPending}
        onCreate={async (title) => {
          await createMutation.mutateAsync(title);
        }}
      />

      {isUnauthorized ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Sign in to view and manage your tasks.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      ) : occurrencesQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No occurrences in {SCOPE_LABELS[scope]}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <TaskRow
              key={item.id}
              item={item}
              category={
                item.task.category_id ? categoryMap.get(item.task.category_id) : undefined
              }
              project={
                item.task.project_id ? projectMap.get(item.task.project_id) : undefined
              }
              onToggleComplete={(it) => toggleMutation.mutate(it)}
              onSelect={setSelectedItem}
            />
          ))}
        </div>
      )}

      <TaskDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <div className="h-8 w-40 animate-pulse rounded bg-card" />
          <div className="h-12 animate-pulse rounded-xl bg-card" />
        </div>
      }
    >
      <TasksWorkspaceContent />
    </Suspense>
  );
}
