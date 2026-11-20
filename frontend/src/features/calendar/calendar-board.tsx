"use client";

import FullCalendar, {
  type CalendarRef,
  type DropInfo,
  type EventDropInfo,
  type EventInput,
  type EventResizeDoneInfo,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin, { Draggable } from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import themePlugin from "@fullcalendar/react/themes/forma";
import viLocale from "@fullcalendar/react/locales/vi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { dateInTimeZone } from "@/features/planning/period";
import { patchOccurrence } from "@/features/tasks/api";
import { TaskDetailPanel } from "@/features/tasks/task-detail-panel";
import type { Category, OccurrenceWithTask, Project } from "@/types/domain";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/forma/theme.css";

type ViewName = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

interface Props {
  items: OccurrenceWithTask[];
  categories: Category[];
  projects: Project[];
  timezone: string;
  firstDay: number;
}

interface PendingMove {
  item: OccurrenceWithTask;
  scheduledDate: string;
  startAt: string | null;
  endAt: string | null;
  conflictCount: number;
}

const VIEWS: { value: ViewName; label: string }[] = [
  { value: "dayGridMonth", label: "Tháng" },
  { value: "timeGridWeek", label: "Tuần" },
  { value: "timeGridDay", label: "Ngày" },
  { value: "listWeek", label: "Danh sách" },
];

const COLORS: Record<Category["accent_token"], { fill: string; line: string; text: string }> = {
  LAVENDER: { fill: "var(--category-lavender-soft)", line: "var(--category-lavender)", text: "var(--category-lavender-text)" },
  SAGE: { fill: "var(--category-sage-soft)", line: "var(--category-sage)", text: "var(--category-sage-text)" },
  PEACH: { fill: "var(--category-peach-soft)", line: "var(--category-peach)", text: "var(--category-peach-text)" },
  ROSE: { fill: "var(--category-rose-soft)", line: "var(--category-rose)", text: "var(--category-rose-text)" },
  BUTTER: { fill: "var(--category-butter-soft)", line: "var(--category-butter)", text: "var(--category-butter-text)" },
  SKY: { fill: "var(--category-sky-soft)", line: "var(--category-sky)", text: "var(--category-sky-text)" },
  SLATE: { fill: "var(--secondary)", line: "var(--border)", text: "var(--foreground)" },
};

function proposedMove(
  item: OccurrenceWithTask,
  start: Date,
  allDay: boolean,
  end: Date | null,
  items: OccurrenceWithTask[],
  timezone: string,
  dateString: string
): PendingMove {
  const startAt = allDay ? null : start.toISOString();
  const endAt = allDay ? null : (end ?? new Date(start.getTime() + (item.estimated_minutes ?? 30) * 60_000)).toISOString();
  const scheduledDate = allDay ? dateString.slice(0, 10) : dateInTimeZone(start, timezone);
  const conflictCount = startAt && endAt ? items.filter((other) =>
    other.id !== item.id && other.status !== "CANCELLED" && other.start_at && other.end_at &&
    other.start_at < endAt && other.end_at > startAt
  ).length : 0;
  return { item, scheduledDate, startAt, endAt, conflictCount };
}

export default function CalendarBoard({ items, categories, projects, timezone, firstDay }: Props) {
  const queryClient = useQueryClient();
  const calendarRef = useRef<CalendarRef>(null);
  const backlogRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewName>("dayGridMonth");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<OccurrenceWithTask | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);
  const backlog = items.filter((item) => item.scheduled_date === null && item.start_at === null &&
    (item.status === "NOT_STARTED" || item.status === "IN_PROGRESS"));

  const events = useMemo<EventInput[]>(() => items.flatMap((item) => {
    const start = item.start_at ?? item.scheduled_date;
    if (!start) return [];
    const category = item.task.category_id ? categoryMap.get(item.task.category_id) : undefined;
    const color = COLORS[category?.accent_token ?? "SLATE"];
    return [{
      id: item.id,
      title: item.task.title,
      start,
      end: item.start_at ? item.end_at ?? new Date(new Date(item.start_at).getTime() + (item.estimated_minutes ?? 30) * 60_000).toISOString() : undefined,
      allDay: !item.start_at,
      startEditable: item.status === "NOT_STARTED" || item.status === "IN_PROGRESS",
      durationEditable: Boolean(item.start_at) && item.status !== "DONE",
      backgroundColor: color.fill,
      borderColor: color.line,
      textColor: color.text,
      classNames: item.status === "DONE" ? ["calendar-done"] : [],
    }];
  }), [items, categoryMap]);

  useEffect(() => {
    if (!backlogRef.current) return;
    const draggable = new Draggable(backlogRef.current, {
      itemSelector: ".calendar-backlog-item",
      eventData: (element) => ({ title: element.textContent ?? "", create: false }),
    });
    return () => draggable.destroy();
  }, [backlog.length]);

  const moveMutation = useMutation({
    mutationFn: (proposal: PendingMove) => patchOccurrence(proposal.item.id, {
      scheduled_date: proposal.scheduledDate,
      start_at: proposal.startAt,
      end_at: proposal.endAt,
      expected_version: proposal.item.version,
    }),
    onSuccess: async () => {
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success("Đã cập nhật lịch thực hiện.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Không lưu được lịch. Tải lại và thử tiếp.");
      void queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] });
    },
  });

  const handleMove = (info: EventDropInfo | EventResizeDoneInfo) => {
    const item = itemMap.get(info.event.id);
    const start = info.event.start;
    info.revert();
    if (!item || !start) return;
    setPending(proposedMove(item, start, info.event.allDay, info.event.end, items, timezone, info.event.startStr));
  };

  const handleExternalDrop = (info: DropInfo) => {
    const item = itemMap.get(info.draggedEl.dataset.occurrenceId ?? "");
    if (!item) return;
    setPending(proposedMove(item, info.date, info.allDay, null, items, timezone, info.dateStr));
  };

  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
    <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => calendarRef.current?.getApi().prev()} aria-label="Kỳ trước" className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Trước</button>
          <button type="button" onClick={() => calendarRef.current?.getApi().today()} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Hôm nay</button>
          <button type="button" onClick={() => calendarRef.current?.getApi().next()} aria-label="Kỳ sau" className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-secondary">Sau</button>
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label="Chế độ xem lịch">
        {VIEWS.map((option) => <button key={option.value} type="button"
          onClick={() => { setView(option.value); calendarRef.current?.getApi().changeView(option.value); }}
          className={`min-h-10 rounded-lg px-3 text-sm ${view === option.value ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
          {option.label}
        </button>)}
      </div>
      <p className="mb-2 text-xs text-muted-foreground sm:hidden">Vuốt ngang để xem các ngày còn lại.</p>
      <div className="calendar-surface">
        <FullCalendar ref={calendarRef}
          plugins={[themePlugin, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth" timeZone={timezone} locale={viLocale} firstDay={firstDay}
          headerToolbar={false} height="auto" dayMaxEvents={3}
          nowIndicator editable droppable selectable={false}
          events={events}
          datesSet={(info) => setTitle(info.view.title)}
          eventClick={(info) => { const item = itemMap.get(info.event.id); if (item) setSelected(item); }}
          eventDrop={handleMove} eventResize={handleMove} drop={handleExternalDrop}
        />
      </div>
    </section>
    <aside className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Chưa xếp lịch</h2>
      <p className="mt-1 text-xs text-muted-foreground">Kéo vào ngày hoặc khung giờ để lên lịch.</p>
      <div ref={backlogRef} className="mt-4 max-h-[35rem] space-y-2 overflow-y-auto">
        {backlog.length === 0 ? <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">Inbox đã trống.</p> :
          backlog.slice(0, 100).map((item) => <button key={item.id} type="button"
            data-occurrence-id={item.id} onClick={() => setSelected(item)}
            className="calendar-backlog-item block w-full cursor-grab rounded-lg border border-border px-3 py-2 text-left text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary">
            <span className="block truncate">{item.task.title}</span>
            {item.task.project_id && projectMap.get(item.task.project_id) && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{projectMap.get(item.task.project_id)?.title}</span>}
          </button>)}
        {backlog.length > 100 && <p className="text-xs text-muted-foreground">Hiển thị 100/{backlog.length} mục. Mở Tasks để xử lý các mục còn lại.</p>}
      </div>
    </aside>

    {pending && <div role="dialog" aria-modal="true" aria-label="Xác nhận đổi lịch"
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <section className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Đổi lịch thực hiện</h2>
        <p className="mt-2 text-sm text-muted-foreground">{pending.item.task.title} → {pending.scheduledDate}{pending.startAt ? ` · ${new Intl.DateTimeFormat("vi-VN", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(pending.startAt))}` : " · Cả ngày"}</p>
        {pending.conflictCount > 0 && <p className="mt-3 rounded-lg bg-[var(--category-butter-soft)] p-3 text-xs text-[var(--category-butter-text)]">Có {pending.conflictCount} khung giờ khác đang trùng. Bạn vẫn có thể lưu nếu chủ động lên lịch song song.</p>}
        {pending.item.task.is_recurring && <p className="mt-3 text-xs text-muted-foreground">Đây là task lặp. Dời trên lịch chỉ sửa lần này; thay đổi các lần tương lai trong quy tắc lặp.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setPending(null)} className="min-h-10 rounded-lg border border-border px-4 text-sm">Hủy</button>
          {pending.item.task.is_recurring && <button type="button" onClick={() => { setSelected(pending.item); setPending(null); }} className="min-h-10 rounded-lg border border-border px-4 text-sm">Các lần tương lai</button>}
          <button type="button" disabled={moveMutation.isPending} onClick={() => moveMutation.mutate(pending)} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{moveMutation.isPending ? "Đang lưu…" : "Chỉ lần này"}</button>
        </div>
      </section>
    </div>}
    <TaskDetailPanel item={selected} onClose={() => setSelected(null)} />
  </div>;
}
