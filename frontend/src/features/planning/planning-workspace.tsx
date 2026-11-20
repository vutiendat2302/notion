"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { RolloverDialog } from "@/features/planning/rollover-dialog";
import {
  dateInTimeZone,
  occurrenceDate,
  occurrencesInPeriod,
  parsePeriod,
  periodKeyForDate,
  shiftPeriod,
  type PeriodScope,
} from "@/features/planning/period";
import {
  fetchCategories,
  fetchOccurrenceCatalog,
  fetchProjects,
  setOccurrenceStatus,
} from "@/features/tasks/api";
import { TaskDetailPanel } from "@/features/tasks/task-detail-panel";
import { TaskRow } from "@/features/tasks/task-row";
import { fetchCurrentUser } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { OccurrenceWithTask } from "@/types/domain";

const SCOPES: PeriodScope[] = ["year", "quarter", "month", "week", "day"];
const LABELS: Record<PeriodScope, string> = {
  year: "Năm", quarter: "Quý", month: "Tháng", week: "Tuần", day: "Ngày",
};

function groupFor(item: OccurrenceWithTask, scope: PeriodScope, timezone: string): string {
  const day = occurrenceDate(item, timezone) ?? "";
  if (scope === "year" || scope === "quarter") return day.slice(0, 7);
  if (scope === "month") return periodKeyForDate("week", day) ?? day;
  return day;
}

export function PlanningWorkspace() {
  const client = useQueryClient();
  const [{ scope, key }, setPeriodQuery] = useQueryStates({
    scope: parseAsStringLiteral(SCOPES).withDefault("week"),
    key: parseAsString,
  });
  const [selected, setSelected] = useState<OccurrenceWithTask | null>(null);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [visible, setVisible] = useState(100);

  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const catalog = useQuery({ queryKey: ["occurrence-catalog"], queryFn: fetchOccurrenceCatalog });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const timezone = user.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const today = dateInTimeZone(new Date(), timezone);
  const currentKey = periodKeyForDate(scope, today) ?? today;
  const period = useMemo(
    () => parsePeriod(scope, key ?? currentKey) ?? parsePeriod(scope, currentKey),
    [scope, key, currentKey]
  );
  const nextKey = period ? shiftPeriod(scope, period.key, 1) : null;
  const nextPeriod = nextKey ? parsePeriod(scope, nextKey) : null;
  const periodItems = useMemo(
    () => period ? occurrencesInPeriod(catalog.data?.items ?? [], period, timezone) : [],
    [catalog.data?.items, period, timezone]
  );
  const categoryMap = useMemo(
    () => new Map((categories.data ?? []).map((entry) => [entry.id, entry])),
    [categories.data]
  );
  const projectMap = useMemo(
    () => new Map((projects.data ?? []).map((entry) => [entry.id, entry])),
    [projects.data]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, OccurrenceWithTask[]>();
    for (const item of periodItems.slice(0, visible)) {
      const label = groupFor(item, scope, timezone);
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return [...map].sort(([a], [b]) => a.localeCompare(b));
  }, [periodItems, scope, timezone, visible]);
  const active = periodItems.filter((item) => item.status === "NOT_STARTED" || item.status === "IN_PROGRESS");
  const completed = periodItems.filter((item) => item.status === "DONE").length;
  const rolloverCandidates = active.filter((item) => item.scheduled_date && !item.start_at);

  const status = useMutation({
    mutationFn: (item: OccurrenceWithTask) =>
      setOccurrenceStatus(item.id, item.status === "DONE" ? "reopen" : "complete"),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["occurrence-catalog"] });
      await client.invalidateQueries({ queryKey: ["occurrences"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không cập nhật được task"),
  });

  const navigate = (newScope: PeriodScope, newKey: string | null) => {
    setVisible(100);
    void setPeriodQuery({ scope: newScope, key: newKey });
  };

  if (user.error instanceof ApiClientError && user.error.status === 401) {
    return <section className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Kế hoạch của bạn</h1>
      <p className="mt-2 text-sm text-muted-foreground">Đăng nhập để xem lịch thực hiện.</p>
      <Link href="/login" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Đăng nhập</Link>
    </section>;
  }

  return <div className="space-y-6">
    <header className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Planning</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Kế hoạch theo kỳ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Một nguồn task, nhiều góc nhìn theo thời gian.</p>
      </div>
      <div role="group" aria-label="Chọn kỳ kế hoạch" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {SCOPES.map((option) => <button key={option} type="button"
          onClick={() => navigate(option, periodKeyForDate(option, today))}
          className={cn("min-h-10 rounded-lg px-4 text-sm transition-colors", scope === option ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
        >{LABELS[option]}</button>)}
      </div>
    </header>

    {period && <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{period.start} → {period.endInclusive} · {timezone}</p>
          <h2 className="mt-1 text-lg font-semibold">{period.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(scope, shiftPeriod(scope, period.key, -1))} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Trước</button>
          <button type="button" onClick={() => navigate(scope, currentKey)} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Hiện tại</button>
          <button type="button" onClick={() => navigate(scope, nextKey)} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Sau</button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm">
        <span><strong className="font-semibold tabular-nums">{periodItems.length}</strong> lần thực hiện</span>
        <span><strong className="font-semibold tabular-nums">{active.length}</strong> cần làm</span>
        <span><strong className="font-semibold tabular-nums">{completed}</strong> đã xong</span>
      </div>
    </section>}

    {catalog.isLoading ? <div aria-busy="true" aria-label="Đang tải kế hoạch" className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-card" />)}</div> :
      catalog.isError ? <div className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">
        Không tải được lịch thực hiện. <button type="button" onClick={() => void catalog.refetch()} className="underline">Thử lại</button>
      </div> : <>
        {catalog.data?.truncated && <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">Đang hiển thị {catalog.data.items.length}/{catalog.data.total} lần thực hiện. Mở Tasks để xem các mục còn lại.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Lịch thực hiện</h2>
          {rolloverCandidates.length > 0 && nextPeriod && <button type="button" onClick={() => setRolloverOpen(true)} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Chuyển mục chưa xong sang kỳ sau</button>}
        </div>
        {periodItems.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Chưa có task trong kỳ này. <Link href="/tasks" className="font-medium text-primary underline">Mở Tasks</Link> để tạo mới.</div> :
          <div className="space-y-6">{grouped.map(([group, items]) => <section key={group} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>
            {items.map((item) => <TaskRow key={item.id} item={item}
              category={item.task.category_id ? categoryMap.get(item.task.category_id) : undefined}
              project={item.task.project_id ? projectMap.get(item.task.project_id) : undefined}
              onToggleComplete={(entry) => status.mutate(entry)} onSelect={setSelected} />)}
          </section>)}</div>}
        {periodItems.length > visible && <button type="button" onClick={() => setVisible((count) => count + 100)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Hiển thị thêm</button>}
      </>}

    {rolloverOpen && period && nextPeriod && <RolloverDialog
      source={period} target={nextPeriod} items={rolloverCandidates}
      onClose={() => setRolloverOpen(false)} />}
    <TaskDetailPanel item={selected} onClose={() => setSelected(null)} />
  </div>;
}
