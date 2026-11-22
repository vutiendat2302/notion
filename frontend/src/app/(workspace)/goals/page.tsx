"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flame, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { DynamicChartCard } from "@/features/analytics/chart-renderer";
import { fetchStreak } from "@/features/analytics/api";
import {
  addMilestone,
  createGoal,
  listGoals,
  toggleMilestone,
} from "@/features/goals/api";
import { createHabit, listHabits, logHabit } from "@/features/habits/api";
import { dateInTimeZone } from "@/features/planning/period";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export default function GoalsAndHabitsPage() {
  const { locale } = useI18n();
  const client = useQueryClient();

  const userQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const timezone = userQuery.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const todayIso = dateInTimeZone(new Date(), timezone);
  const currentMonth = todayIso.slice(0, 7);

  const goalsQuery = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  const habitsQuery = useQuery({
    queryKey: ["habits", currentMonth],
    queryFn: () => listHabits(currentMonth),
  });
  const streakQuery = useQuery({ queryKey: ["streak"], queryFn: fetchStreak });

  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("100");
  const [habitTitle, setHabitTitle] = useState("");
  const [milestoneInputs, setMilestoneInputs] = useState<Record<string, string>>({});

  const createGoalMut = useMutation({
    mutationFn: () =>
      createGoal({
        title: goalTitle.trim(),
        goal_type: "MILESTONE_BASED",
        metric_unit: "%",
        target_value: Number(goalTarget) || 100,
        start_date: todayIso,
        end_date: `${todayIso.slice(0, 4)}-12-31`,
      }),
    onSuccess: async () => {
      setGoalTitle("");
      await client.invalidateQueries({ queryKey: ["goals"] });
      toast.success(locale === "en" ? "Goal created" : "Đã tạo mục tiêu");
    },
  });

  const addMsMut = useMutation({
    mutationFn: ({ goalId, title }: { goalId: string; title: string }) =>
      addMilestone(goalId, { title }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const toggleMsMut = useMutation({
    mutationFn: ({
      goalId,
      msId,
      status,
    }: {
      goalId: string;
      msId: string;
      status: "PENDING" | "COMPLETED";
    }) => toggleMilestone(goalId, msId, status),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const createHabitMut = useMutation({
    mutationFn: () => createHabit({ title: habitTitle.trim(), starts_on: todayIso }),
    onSuccess: async () => {
      setHabitTitle("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["habits"] }),
        client.invalidateQueries({ queryKey: ["chart", "habit_consistency_heatmap"] }),
      ]);
      toast.success(locale === "en" ? "Habit added" : "Đã thêm thói quen");
    },
  });

  const logHabitMut = useMutation({
    mutationFn: ({ habitId, status }: { habitId: string; status: "COMPLETED" | "SKIPPED" }) =>
      logHabit(habitId, { log_date: todayIso, status }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["habits"] }),
        client.invalidateQueries({ queryKey: ["streak"] }),
        client.invalidateQueries({ queryKey: ["chart"] }),
      ]);
    },
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-end gap-3">
        <h1 className="sr-only">{locale === "en" ? "Goals & Habits" : "Mục tiêu & Thói quen"}</h1>
        {streakQuery.data && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Flame className="h-4 w-4 text-primary" />
              {streakQuery.data.current_streak}d
            </span>
            <span className="text-muted-foreground">Best: {streakQuery.data.best_streak}d</span>
            <span className="text-muted-foreground">30d: {streakQuery.data.consistency_30d}%</span>
          </div>
        )}
      </header>

      {/* Habits Section (Full-width borderless section) */}
      <section className="space-y-4 border-t border-border/70 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {locale === "en" ? "Daily Habits" : "Thói quen hằng ngày"}
          </h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (habitTitle.trim()) createHabitMut.mutate();
            }}
            className="flex gap-2"
          >
            <input
              value={habitTitle}
              onChange={(e) => setHabitTitle(e.target.value)}
              placeholder={locale === "en" ? "New habit..." : "Thói quen mới..."}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
            />
            <button
              type="submit"
              disabled={!habitTitle.trim() || createHabitMut.isPending}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{locale === "en" ? "Add" : "Thêm"}</span>
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          {(habitsQuery.data ?? []).map((h) => {
            const doneToday = h.logs.some(
              (l) => l.log_date === todayIso && l.status === "COMPLETED"
            );
            return (
              <button
                key={h.id}
                type="button"
                onClick={() =>
                  logHabitMut.mutate({
                    habitId: h.id,
                    status: doneToday ? "SKIPPED" : "COMPLETED",
                  })
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                  doneToday
                    ? "border-emerald-500/60 bg-emerald-500/15 text-foreground"
                    : "border-border bg-background hover:bg-secondary"
                )}
              >
                <Check
                  className={cn("h-3.5 w-3.5", doneToday ? "text-emerald-500" : "text-muted-foreground")}
                />
                <span>{h.title}</span>
              </button>
            );
          })}
        </div>

        <DynamicChartCard
          chartKey="habit_consistency_heatmap"
          title={locale === "en" ? "Consistency Matrix" : "Bảng đều đặn tháng"}
          filters={{ period_key: currentMonth }}
        />
      </section>

      {/* Goals & Milestones Section */}
      <section className="space-y-4 border-t border-border/70 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {locale === "en" ? "Goals" : "Mục tiêu"}
          </h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (goalTitle.trim()) createGoalMut.mutate();
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder={locale === "en" ? "Goal title..." : "Tên mục tiêu..."}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
            />
            <input
              type="number"
              min={1}
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-xs font-mono"
            />
            <button
              type="submit"
              disabled={!goalTitle.trim() || createGoalMut.isPending}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{locale === "en" ? "Add Goal" : "Tạo mục tiêu"}</span>
            </button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(goalsQuery.data ?? []).map((g) => (
            <div key={g.id} className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">{g.title}</h3>
                <span className="font-mono text-sm font-bold text-primary">{g.progress_percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  style={{ width: `${Math.min(100, g.progress_percent)}%` }}
                  className="h-full rounded-full bg-primary"
                />
              </div>

              <div className="space-y-1.5">
                {g.milestones.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={m.status === "COMPLETED"}
                      onChange={(e) =>
                        toggleMsMut.mutate({
                          goalId: g.id,
                          msId: m.id,
                          status: e.target.checked ? "COMPLETED" : "PENDING",
                        })
                      }
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <span className={m.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}>
                      {m.title}
                    </span>
                  </label>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = milestoneInputs[g.id]?.trim();
                  if (!val) return;
                  addMsMut.mutate({ goalId: g.id, title: val });
                  setMilestoneInputs((prev) => ({ ...prev, [g.id]: "" }));
                }}
                className="flex gap-2"
              >
                <input
                  value={milestoneInputs[g.id] ?? ""}
                  onChange={(e) =>
                    setMilestoneInputs((prev) => ({ ...prev, [g.id]: e.target.value }))
                  }
                  placeholder={locale === "en" ? "+ Milestone..." : "+ Cột mốc mới..."}
                  className="h-8 flex-1 rounded-lg border border-input bg-card px-2.5 text-xs"
                />
                <button
                  type="submit"
                  className="h-8 rounded-lg border border-border px-2.5 text-xs hover:bg-secondary"
                >
                  +
                </button>
              </form>
            </div>
          ))}
        </div>

        {(goalsQuery.data ?? []).length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <DynamicChartCard chartKey="goal_progress" title="Goal Progress" />
            <DynamicChartCard chartKey="goal_milestone_timeline" title="Milestone Timeline" />
          </div>
        )}
      </section>
    </div>
  );
}
