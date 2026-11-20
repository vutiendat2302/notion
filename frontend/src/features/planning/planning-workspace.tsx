"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { addPlanItem, fetchPeriod, patchPlanItem, removePlanItem, savePlan, type PeriodOverview } from "@/features/planning/api";
import { RolloverDialog } from "@/features/planning/rollover-dialog";
import { dateInTimeZone, occurrenceDate, parsePeriod, periodKeyForDate, shiftPeriod, type PeriodScope } from "@/features/planning/period";
import { fetchCategories, fetchProjects, setOccurrenceStatus } from "@/features/tasks/api";
import { TaskDetailPanel } from "@/features/tasks/task-detail-panel";
import { TaskRow } from "@/features/tasks/task-row";
import { fetchCurrentUser } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { OccurrenceWithTask } from "@/types/domain";

const SCOPES: PeriodScope[] = ["year", "quarter", "month", "week", "day"];
const LABELS: Record<PeriodScope, string> = { year: "Năm", quarter: "Quý", month: "Tháng", week: "Tuần", day: "Ngày" };

function groupFor(item: OccurrenceWithTask, scope: PeriodScope, timezone: string): string {
  const day = occurrenceDate(item, timezone) ?? "";
  if (scope === "year" || scope === "quarter") return day.slice(0, 7);
  if (scope === "month") return periodKeyForDate("week", day) ?? day;
  return day;
}

function PlanEditor({ overview, onSaved }: { overview: PeriodOverview; onSaved: () => Promise<void> }) {
  const plan = overview.saved_plan;
  const [title, setTitle] = useState(plan?.title ?? "");
  const [focus, setFocus] = useState(plan?.focus_summary ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "CLOSED">(plan?.status === "CLOSED" ? "CLOSED" : plan?.status === "DRAFT" ? "DRAFT" : "ACTIVE");
  const save = useMutation({
    mutationFn: () => savePlan(overview.period_type, overview.period_key, { title: title.trim() || null, focus_summary: focus.trim() || null, notes: notes.trim() || null, status, ...(plan ? { expected_version: plan.version } : {}) }),
    onSuccess: async () => { await onSaved(); toast.success("Đã lưu kế hoạch."); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không lưu được kế hoạch. Tải lại và thử tiếp."),
  });
  const changed = title !== (plan?.title ?? "") || focus !== (plan?.focus_summary ?? "") || notes !== (plan?.notes ?? "") || status !== (plan?.status ?? "ACTIVE");
  return <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Kế hoạch đã lưu</h2><span className="text-xs text-muted-foreground">{plan ? `Phiên bản ${plan.version}` : "Chưa lưu"}</span></div>
    <div className="mt-4 grid gap-3">
      <label className="grid gap-1 text-xs font-medium">Tên kế hoạch<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" placeholder="Ví dụ: Tập trung hoàn thiện sản phẩm" /></label>
      <label className="grid gap-1 text-xs font-medium">Trọng tâm<textarea value={focus} onChange={(event) => setFocus(event.target.value)} maxLength={10000} rows={2} className="rounded-lg border border-border bg-background p-3 text-sm font-normal" placeholder="Điều quan trọng nhất trong kỳ này" /></label>
      <label className="grid gap-1 text-xs font-medium">Ghi chú<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={20000} rows={2} className="rounded-lg border border-border bg-background p-3 text-sm font-normal" placeholder="Ý tưởng, trở ngại hoặc tổng kết" /></label>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs font-medium">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="min-h-10 rounded-lg border border-border bg-background px-2 text-sm"><option value="DRAFT">Nháp</option><option value="ACTIVE">Đang thực hiện</option><option value="CLOSED">Đã đóng</option></select></label><button type="button" disabled={!changed || save.isPending} onClick={() => save.mutate()} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{save.isPending ? "Đang lưu…" : "Lưu kế hoạch"}</button></div>
  </section>;
}

export function PlanningWorkspace() {
  const client = useQueryClient();
  const [{ scope, key }, setPeriodQuery] = useQueryStates({ scope: parseAsStringLiteral(SCOPES).withDefault("week"), key: parseAsString });
  const [selected, setSelected] = useState<OccurrenceWithTask | null>(null);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [visible, setVisible] = useState(100);
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const timezone = user.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const today = dateInTimeZone(new Date(), timezone);
  const currentKey = periodKeyForDate(scope, today) ?? today;
  const period = useMemo(() => parsePeriod(scope, key ?? currentKey) ?? parsePeriod(scope, currentKey), [scope, key, currentKey]);
  const periodType = scope.toUpperCase() as Uppercase<PeriodScope>;
  const overview = useQuery({ queryKey: ["planning-period", periodType, period?.key], queryFn: () => fetchPeriod(periodType, period!.key), enabled: Boolean(period) && Boolean(user.data) });
  const nextKey = period ? shiftPeriod(scope, period.key, 1) : null;
  const periodItems = useMemo(() => overview.data?.occurrences ?? [], [overview.data?.occurrences]);
  const categoryMap = useMemo(() => new Map((categories.data ?? []).map((entry) => [entry.id, entry])), [categories.data]);
  const projectMap = useMemo(() => new Map((projects.data ?? []).map((entry) => [entry.id, entry])), [projects.data]);
  const grouped = useMemo(() => {
    const map = new Map<string, OccurrenceWithTask[]>();
    for (const item of periodItems.slice(0, visible)) { const label = groupFor(item, scope, timezone); map.set(label, [...(map.get(label) ?? []), item]); }
    return [...map].sort(([a], [b]) => a.localeCompare(b));
  }, [periodItems, scope, timezone, visible]);
  const active = periodItems.filter((item) => item.status === "NOT_STARTED" || item.status === "IN_PROGRESS").length;
  const completed = periodItems.filter((item) => item.status === "DONE").length;
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["planning-period"] }); };
  const status = useMutation({
    mutationFn: (item: OccurrenceWithTask) => setOccurrenceStatus(item.id, item.status === "DONE" ? "reopen" : "complete"),
    onSuccess: async () => { await Promise.all([refresh(), client.invalidateQueries({ queryKey: ["occurrences"] })]); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không cập nhật được task"),
  });
  const pinnedIds = new Set((overview.data?.plan_items ?? []).map((item) => item.occurrence_id));
  const pin = useMutation({
    mutationFn: async (item: OccurrenceWithTask) => {
      let plan = overview.data?.saved_plan;
      if (!plan) plan = await savePlan(periodType, period!.key, { title: null, focus_summary: null, notes: null, status: "ACTIVE" });
      return addPlanItem(plan.id, item.id);
    },
    onSuccess: async () => { await refresh(); toast.success("Đã ghim vào kế hoạch."); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không ghim được mục."),
  });
  const planItemMutation = useMutation({
    mutationFn: async ({ itemId, commitment, remove }: { itemId: string; commitment?: "PLANNED" | "COMMITTED" | "OPTIONAL"; remove?: boolean }) => {
      const planId = overview.data?.saved_plan?.id;
      if (!planId) throw new Error("Không tìm thấy kế hoạch.");
      return remove ? removePlanItem(planId, itemId) : patchPlanItem(planId, itemId, { commitment });
    },
    onSuccess: refresh,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không cập nhật được mục kế hoạch."),
  });
  const navigate = (newScope: PeriodScope, newKey: string | null) => { setVisible(100); setRolloverOpen(false); void setPeriodQuery({ scope: newScope, key: newKey }); };

  if (user.error instanceof ApiClientError && user.error.status === 401) return <section className="rounded-xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">Kế hoạch của bạn</h1><p className="mt-2 text-sm text-muted-foreground">Đăng nhập để xem lịch thực hiện.</p><Link href="/login" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Đăng nhập</Link></section>;
  return <div className="space-y-6">
    <header className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Planning</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Kế hoạch theo kỳ</h1><p className="mt-1 text-sm text-muted-foreground">Một nguồn task, nhiều góc nhìn theo thời gian.</p></div><div role="group" aria-label="Chọn kỳ kế hoạch" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">{SCOPES.map((option) => <button key={option} type="button" onClick={() => navigate(option, periodKeyForDate(option, today))} className={cn("min-h-10 rounded-lg px-4 text-sm transition-colors", scope === option ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>{LABELS[option]}</button>)}</div></header>
    {period && <section className="rounded-xl border border-border bg-card p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{overview.data?.start_date ?? period.start} → {overview.data?.end_date_exclusive ?? period.endExclusive} (không gồm ngày cuối) · {overview.data?.timezone ?? timezone}</p><h2 className="mt-1 text-lg font-semibold">{period.title}</h2></div><div className="flex items-center gap-2"><button type="button" onClick={() => navigate(scope, shiftPeriod(scope, period.key, -1))} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Trước</button><button type="button" onClick={() => navigate(scope, currentKey)} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Hiện tại</button><button type="button" onClick={() => navigate(scope, nextKey)} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Sau</button></div></div>{overview.data && <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm"><span><strong className="font-semibold tabular-nums">{periodItems.length}</strong> lần thực hiện</span><span><strong className="font-semibold tabular-nums">{active}</strong> cần làm</span><span><strong className="font-semibold tabular-nums">{completed}</strong> đã xong</span><span><strong className="font-semibold tabular-nums">{overview.data.planned_focus_minutes}</strong> phút dự kiến</span></div>}</section>}
    {overview.isLoading || user.isLoading ? <div aria-busy="true" aria-label="Đang tải kế hoạch" className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-card" />)}</div> : overview.isError || user.isError ? <div className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">Không tải được kế hoạch. <button type="button" onClick={() => void overview.refetch()} className="underline">Thử lại</button></div> : overview.data && <>
      <PlanEditor key={`${overview.data.period_type}-${overview.data.period_key}-${overview.data.saved_plan?.version ?? 0}`} overview={overview.data} onSaved={refresh} />
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Mục ưu tiên đã ghim</h2><span className="text-xs text-muted-foreground">{overview.data.plan_items.length} mục</span></div>{overview.data.plan_items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Chưa có mục ưu tiên. Chọn Ghim ở lịch thực hiện bên dưới.</p> : <div className="mt-3 space-y-2">{overview.data.plan_items.map((item) => { const occurrence = [...overview.data.occurrences, ...overview.data.overdue_occurrences].find((entry) => entry.id === item.occurrence_id); return <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"><span className="min-w-0 flex-1 truncate">{occurrence?.task.title ?? `${item.target_key}`}</span><select aria-label="Mức cam kết" value={item.commitment} onChange={(event) => planItemMutation.mutate({ itemId: item.id, commitment: event.target.value as typeof item.commitment })} className="min-h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="PLANNED">Dự kiến</option><option value="COMMITTED">Cam kết</option><option value="OPTIONAL">Tùy chọn</option></select><button type="button" onClick={() => planItemMutation.mutate({ itemId: item.id, remove: true })} className="min-h-9 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary">Bỏ ghim</button></div>; })}</div>}</section>
      {overview.data.overdue_occurrences.length > 0 && <section className="rounded-xl border border-[var(--category-butter)] bg-card p-4 sm:p-6"><h2 className="text-sm font-semibold">Cần xem lại · {overview.data.overdue_occurrences.length} mục quá hạn</h2><p className="mt-1 text-xs text-muted-foreground">Các mục này không thuộc kỳ hiện tại. Xem Tasks để xử lý hoặc sắp lịch lại.</p><div className="mt-3 space-y-2">{overview.data.overdue_occurrences.slice(0, 10).map((item) => <TaskRow key={item.id} item={item} category={item.task.category_id ? categoryMap.get(item.task.category_id) : undefined} project={item.task.project_id ? projectMap.get(item.task.project_id) : undefined} onToggleComplete={(entry) => status.mutate(entry)} onSelect={setSelected} />)}</div></section>}
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Lịch thực hiện</h2><button type="button" onClick={() => setRolloverOpen(true)} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Chuyển mục chưa xong sang kỳ sau</button></div>
      {periodItems.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Chưa có task trong kỳ này. <Link href="/tasks" className="font-medium text-primary underline">Mở Tasks</Link> để tạo mới.</div> : <div className="space-y-6">{grouped.map(([group, items]) => <section key={group} className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>{items.map((item) => <div key={item.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><TaskRow item={item} category={item.task.category_id ? categoryMap.get(item.task.category_id) : undefined} project={item.task.project_id ? projectMap.get(item.task.project_id) : undefined} onToggleComplete={(entry) => status.mutate(entry)} onSelect={setSelected} /></div>{!pinnedIds.has(item.id) && <button type="button" disabled={pin.isPending} onClick={() => pin.mutate(item)} className="min-h-10 rounded-lg border border-border px-3 text-xs hover:bg-secondary disabled:opacity-50">Ghim</button>}</div>)}</section>)}</div>}
      {periodItems.length > visible && <button type="button" onClick={() => setVisible((count) => count + 100)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Hiển thị thêm</button>}
    </>}
    {rolloverOpen && period && <RolloverDialog type={periodType} periodKey={period.key} onClose={() => setRolloverOpen(false)} />}
    <TaskDetailPanel item={selected} onClose={() => setSelected(null)} />
  </div>;
}
