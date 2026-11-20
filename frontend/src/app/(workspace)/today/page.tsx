"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  completeOccurrence,
  createTask,
  fetchCategories,
  fetchOccurrenceCatalog,
  fetchOccurrences,
  fetchProjects,
  reopenOccurrence,
} from "@/features/tasks/api";
import { dateInTimeZone } from "@/features/planning/period";
import { fetchCurrentUser } from "@/features/users/api";
import { QuickAddTask } from "@/features/tasks/quick-add-task";
import { TaskDetailPanel } from "@/features/tasks/task-detail-panel";
import { TaskRow } from "@/features/tasks/task-row";
import { ApiClientError } from "@/lib/api/client";
import type { Category, OccurrenceWithTask, Project } from "@/types/domain";

export default function TodayPage() {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<OccurrenceWithTask | null>(null);
  const userQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const catalogQuery = useQuery({ queryKey: ["occurrence-catalog"], queryFn: fetchOccurrenceCatalog });
  const timezone = userQuery.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const todayIso = dateInTimeZone(new Date(), timezone);
  const todayHeading = new Intl.DateTimeFormat("vi-VN", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const occurrencesQuery = useQuery({
    queryKey: ["occurrences", "today"],
    queryFn: () => fetchOccurrences("today"),
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
    mutationFn: (title: string) =>
      createTask({ title, scheduled_date: todayIso, priority: "MEDIUM" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["occurrences"] }),
        queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] }),
      ]);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["occurrences"] }),
        queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] }),
      ]);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update occurrence");
    },
  });

  const items = occurrencesQuery.data?.items ?? [];
  const topPriorities = items
    .filter((i) => i.task.priority === "URGENT" || i.task.priority === "HIGH")
    .slice(0, 3);
  const completedToday = (catalogQuery.data?.items ?? []).filter((entry) =>
    entry.status === "DONE" && entry.completed_at && dateInTimeZone(entry.completed_at, timezone) === todayIso
  );

  const isUnauthorized =
    occurrencesQuery.error instanceof ApiClientError &&
    occurrencesQuery.error.status === 401;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Today
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {todayHeading}
        </h1>
        <p className="text-sm text-muted-foreground">
          Focus on what matters today without visual noise.
        </p>
      </section>

      <QuickAddTask
        placeholder="Quick add for Today (press Enter)..."
        isSubmitting={createMutation.isPending}
        onCreate={async (title) => {
          await createMutation.mutateAsync(title);
        }}
      />

      {isUnauthorized ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">
            Authentication required
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in or bootstrap your owner account to load your Today tasks from Backend MySQL.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go to Sign in / Bootstrap
          </Link>
        </div>
      ) : occurrencesQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-6">
          <p className="text-sm font-medium text-destructive">
            {occurrencesQuery.error instanceof Error
              ? occurrencesQuery.error.message
              : "Could not load today occurrences."}
          </p>
          <button
            type="button"
            onClick={() => void occurrencesQuery.refetch()}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            Retry
          </button>
        </div>
      ) : occurrencesQuery.isLoading ? (
        <div className="space-y-2.5" aria-busy="true" aria-label="Loading today tasks">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-12 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : (
        <>
          {topPriorities.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Top Priorities
              </h2>
              <div className="space-y-2">
                {topPriorities.map((item) => (
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
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Đến hôm nay & quá hạn
              </h2>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {completedToday.length} hoàn thành hôm nay
              </span>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No tasks scheduled for today.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use the quick add bar above or triage unscheduled items from your Tasks Inbox.
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
          </section>
          {completedToday.length > 0 && <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Đã hoàn thành hôm nay</h2>
            <div className="space-y-2">{completedToday.map((entry) => <TaskRow key={entry.id} item={entry}
              category={entry.task.category_id ? categoryMap.get(entry.task.category_id) : undefined}
              project={entry.task.project_id ? projectMap.get(entry.task.project_id) : undefined}
              onToggleComplete={(it) => toggleMutation.mutate(it)} onSelect={setSelectedItem} />)}</div>
          </section>}
          {catalogQuery.data?.truncated && <p className="text-xs text-muted-foreground">Danh sách đã hoàn thành có thể chưa đầy đủ do giới hạn tải 10.000 lần thực hiện.</p>}
        </>
      )}

      <TaskDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
