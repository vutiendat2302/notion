"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RecurrenceEditor } from "@/features/tasks/recurrence-editor";
import {
  archiveChecklistItem,
  createChecklistItem,
  createDependency,
  createSubtask,
  fetchChecklist,
  fetchChecklistStates,
  fetchDependencies,
  fetchSubtasks,
  fetchTask,
  fetchTaskProgress,
  patchOccurrence,
  patchTask,
  removeDependency,
  searchTasks,
  setChecklistState,
  setOccurrenceStatus,
} from "@/features/tasks/api";
import { fetchCurrentUser } from "@/features/users/api";
import { formatMinutes, PRIORITY_LABELS } from "@/lib/utils";
import type { OccurrenceStatus, OccurrenceWithTask, TaskPriority } from "@/types/domain";

interface TaskDetailPanelProps {
  item: OccurrenceWithTask | null;
  onClose: () => void;
}

const fieldClass = "min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary";
const smallButton = "min-h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary disabled:opacity-50";
const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  NOT_STARTED: "Chưa bắt đầu", IN_PROGRESS: "Đang thực hiện", DONE: "Hoàn thành",
  SKIPPED: "Đã bỏ qua", CANCELLED: "Đã hủy",
};
type PanelTab = "details" | "checklist" | "relations" | "recurrence";

function DependencyRow({ blockingTaskId, onRemove, disabled }: { blockingTaskId: string; onRemove: () => void; disabled: boolean }) {
  const blocker = useQuery({ queryKey: ["task", blockingTaskId], queryFn: () => fetchTask(blockingTaskId), retry: false });
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-xs">
    <span className="min-w-0 truncate" title={blocker.data?.title ?? blockingTaskId}>{blocker.data?.title ?? (blocker.isLoading ? "Đang tải…" : blockingTaskId)}</span>
    <button type="button" disabled={disabled} onClick={onRemove} className="text-destructive">Gỡ</button>
  </div>;
}

function PanelContent({ item, onClose }: { item: OccurrenceWithTask; onClose: () => void }) {
  const queryClient = useQueryClient();
  const taskId = item.task_id;
  const occurrenceId = item.id;
  const [tab, setTab] = useState<PanelTab>("details");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(item.task.title);
  const [description, setDescription] = useState(item.task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(item.task.priority);
  const [scheduledDate, setScheduledDate] = useState(item.scheduled_date ?? "");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [blockingId, setBlockingId] = useState("");
  const [blockerSearch, setBlockerSearch] = useState("");
  const [blockerTitle, setBlockerTitle] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);

  const taskQuery = useQuery({ queryKey: ["task", taskId], queryFn: () => fetchTask(taskId), retry: false });
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: fetchCurrentUser, retry: false });
  const checklistQuery = useQuery({ queryKey: ["checklist", taskId], queryFn: () => fetchChecklist(taskId), enabled: tab === "checklist", retry: false });
  const statesQuery = useQuery({ queryKey: ["checklist-states", occurrenceId], queryFn: () => fetchChecklistStates(occurrenceId), enabled: tab === "checklist", retry: false });
  const subtasksQuery = useQuery({ queryKey: ["subtasks", taskId], queryFn: () => fetchSubtasks(taskId), enabled: tab === "relations", retry: false });
  const dependenciesQuery = useQuery({ queryKey: ["dependencies", taskId], queryFn: () => fetchDependencies(taskId), enabled: tab === "relations", retry: false });
  const blockerOptions = useQuery({ queryKey: ["task-options", blockerSearch], queryFn: () => searchTasks(blockerSearch.trim()), enabled: tab === "relations" && blockerSearch.trim().length >= 2, retry: false });
  const progressQuery = useQuery({ queryKey: ["task-progress", taskId], queryFn: () => fetchTaskProgress(taskId), enabled: tab === "details", retry: false });

  const task = taskQuery.data ?? item.task;
  const liveOccurrence = taskQuery.data?.occurrences.find((occurrence) => occurrence.id === occurrenceId);
  const occurrence = liveOccurrence ?? item;
  const timezone = userQuery.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";

  useEffect(() => {
    closeButton.current?.focus();
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
      queryClient.invalidateQueries({ queryKey: ["occurrences"] }),
      queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["task-progress", taskId] }),
    ]);
  }

  async function run(action: () => Promise<unknown>, success: string, keys: string[][] = []) {
    if (saving) return false;
    setSaving(true);
    try {
      await action();
      await refresh();
      await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được thay đổi.");
      await refresh();
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveTask() {
    const nextTitle = title.trim();
    if (!nextTitle) { toast.error("Tên task không được để trống."); return; }
    await run(
      () => patchTask(taskId, { title: nextTitle, description: description.trim() || null, priority, expected_version: task.version }),
      "Đã lưu task."
    );
  }

  async function saveSchedule() {
    if (occurrence.start_at && scheduledDate !== occurrence.scheduled_date) {
      toast.error("Lần có khung giờ cần được dời trong Calendar để giữ đúng giờ bắt đầu/kết thúc.");
      return;
    }
    await run(() => patchOccurrence(occurrenceId, { scheduled_date: scheduledDate || null, expected_version: occurrence.version }), "Đã cập nhật ngày thực hiện.");
  }

  const states = new Map((statesQuery.data ?? []).map((state) => [state.checklist_item_id, state.is_checked]));
  const activeChecklist = (checklistQuery.data ?? []).filter((entry) => !entry.archived_at);

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-label={`Chi tiết ${task.title}`} className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0"><p className="text-xs text-muted-foreground">Lần thực hiện · {occurrence.recurrence_key}</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{task.title}</h2>
        </div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng chi tiết task" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"><X className="h-4 w-4" /></button>
      </header>
      <nav className="flex overflow-x-auto border-b border-border px-3" aria-label="Nội dung task">
        {([
          ["details", "Chi tiết"], ["checklist", "Checklist"], ["relations", "Liên kết"], ["recurrence", "Lặp lại"],
        ] as [PanelTab, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)}
          className={`shrink-0 border-b-2 px-3 py-3 text-sm ${tab === value ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} aria-current={tab === value ? "page" : undefined}>{label}</button>)}
      </nav>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
        {taskQuery.isError && <p className="rounded-lg bg-secondary p-3 text-sm text-destructive">Không tải được dữ liệu mới nhất. <button type="button" className="underline" onClick={() => void taskQuery.refetch()}>Thử lại</button></p>}
        {tab === "details" && <>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Trạng thái lần này</span><strong className="text-sm">{STATUS_LABELS[occurrence.status]}</strong></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {occurrence.status === "NOT_STARTED" && <button className={smallButton} disabled={saving} onClick={() => void run(() => setOccurrenceStatus(occurrenceId, "start"), "Đã bắt đầu.")} type="button">Bắt đầu</button>}
              {(["NOT_STARTED", "IN_PROGRESS"] as OccurrenceStatus[]).includes(occurrence.status) && <>
                <button className={smallButton} disabled={saving} onClick={() => void run(() => setOccurrenceStatus(occurrenceId, "complete"), "Đã hoàn thành.")} type="button">Hoàn thành</button>
                <button className={smallButton} disabled={saving} onClick={() => void run(() => setOccurrenceStatus(occurrenceId, "skip"), "Đã bỏ qua.")} type="button">Bỏ qua</button>
                <button className={smallButton} disabled={saving} onClick={() => void run(() => setOccurrenceStatus(occurrenceId, "cancel"), "Đã hủy lần này.")} type="button">Hủy lần này</button>
              </>}
              {(["DONE", "SKIPPED", "CANCELLED"] as OccurrenceStatus[]).includes(occurrence.status) && <button className={smallButton} disabled={saving} onClick={() => void run(() => setOccurrenceStatus(occurrenceId, "reopen"), "Đã mở lại.")} type="button">Mở lại</button>}
            </div>
          </div>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void saveTask(); }}>
            <h3 className="font-semibold">Nội dung task</h3>
            <label className="block space-y-1 text-xs text-muted-foreground">Tên task
              <input className={fieldClass} maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">Mô tả
              <textarea className={`${fieldClass} min-h-24 py-2`} value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">Ưu tiên
              <select className={fieldClass} value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as TaskPriority[]).map((value) => <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>)}
              </select>
            </label>
            <button type="submit" disabled={saving || taskQuery.isError} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Lưu task</button>
          </form>
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="font-semibold">Lịch của lần này</h3>
            <label className="block space-y-1 text-xs text-muted-foreground">Ngày thực hiện
              <input className={fieldClass} type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
            </label>
            {occurrence.start_at && <p className="text-xs text-muted-foreground">Có khung giờ: {new Intl.DateTimeFormat("vi-VN", { timeZone: timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(occurrence.start_at))}. Dời bằng Calendar.</p>}
            <div className="flex items-center justify-between gap-2"><button type="button" className={smallButton} disabled={saving || taskQuery.isError} onClick={() => void saveSchedule()}>Lưu ngày</button><span className="text-xs text-muted-foreground">Ước tính: {occurrence.estimated_minutes ? formatMinutes(occurrence.estimated_minutes) : "—"}</span></div>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="font-semibold">Tiến độ task</h3>
            {progressQuery.isLoading ? <p className="text-xs text-muted-foreground">Đang tải…</p> : progressQuery.isError ? <p className="text-xs text-destructive">Không tải được tiến độ.</p> : progressQuery.data && <>
              <p className="text-sm">{progressQuery.data.completion_rate === null ? "Chưa có lần đủ điều kiện" : `${progressQuery.data.completion_rate}% hoàn thành`}</p>
              <p className="text-xs text-muted-foreground">{progressQuery.data.completed_count}/{progressQuery.data.eligible_count} lần · {progressQuery.data.skipped_count} bỏ qua · {progressQuery.data.future_excluded_count} lần tương lai chưa tính</p>
              <p className="text-xs text-muted-foreground">Tính đến {progressQuery.data.as_of} · {progressQuery.data.timezone}. Lần đã hủy được loại trừ.</p>
            </>}
          </div>
        </>}
        {tab === "checklist" && <section className="space-y-3">
          <h3 className="font-semibold">Checklist của task</h3>
          <p className="text-xs text-muted-foreground">Mỗi lần thực hiện có trạng thái tick riêng.</p>
          {(checklistQuery.isError || statesQuery.isError) && <p className="text-xs text-destructive">Không tải được checklist. <button type="button" className="underline" onClick={() => { void checklistQuery.refetch(); void statesQuery.refetch(); }}>Thử lại</button></p>}
          {activeChecklist.map((entry) => <div key={entry.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
            <input type="checkbox" aria-label={`Hoàn thành ${entry.title}`} checked={states.get(entry.id) ?? false} disabled={saving} onChange={(event) => void run(() => setChecklistState(occurrenceId, entry.id, event.target.checked), "Đã cập nhật checklist.", [["checklist-states", occurrenceId]])} />
            <span className="min-w-0 flex-1 text-sm">{entry.title}</span>
            <button type="button" className="text-xs text-muted-foreground hover:text-destructive" disabled={saving} onClick={() => void run(() => archiveChecklistItem(taskId, entry.id), "Đã lưu trữ mục checklist.", [["checklist", taskId], ["checklist-states", occurrenceId]])}>Lưu trữ</button>
          </div>)}
          {!checklistQuery.isLoading && activeChecklist.length === 0 && <p className="text-xs text-muted-foreground">Chưa có mục nào.</p>}
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!checklistTitle.trim()) return; void run(() => createChecklistItem(taskId, checklistTitle.trim()), "Đã thêm mục checklist.", [["checklist", taskId], ["checklist-states", occurrenceId]]).then((saved) => { if (saved) setChecklistTitle(""); }); }}>
            <input className={fieldClass} value={checklistTitle} onChange={(event) => setChecklistTitle(event.target.value)} maxLength={255} placeholder="Thêm mục checklist" aria-label="Tên mục checklist" />
            <button type="submit" className={smallButton} disabled={saving || !checklistTitle.trim()}>Thêm</button>
          </form>
        </section>}
        {tab === "relations" && <>
          <section className="space-y-3"><h3 className="font-semibold">Subtasks</h3>
            {subtasksQuery.isError && <p className="text-xs text-destructive">Không tải được subtasks. <button type="button" className="underline" onClick={() => void subtasksQuery.refetch()}>Thử lại</button></p>}
            {(subtasksQuery.data ?? []).map((child) => <div key={child.id} className="rounded-lg border border-border p-2.5 text-sm">{child.title}</div>)}
            {!subtasksQuery.isLoading && (subtasksQuery.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Chưa có subtask.</p>}
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!subtaskTitle.trim()) return; void run(() => createSubtask(taskId, subtaskTitle.trim()), "Đã thêm subtask.", [["subtasks", taskId]]).then((saved) => { if (saved) setSubtaskTitle(""); }); }}>
              <input className={fieldClass} value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} maxLength={255} placeholder="Tên subtask" aria-label="Tên subtask" />
              <button type="submit" className={smallButton} disabled={saving || !subtaskTitle.trim()}>Thêm</button>
            </form>
          </section>
          <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">Bị chặn bởi</h3>
            <p className="text-xs text-muted-foreground">Các task cần hoàn tất trước task này.</p>
            {dependenciesQuery.isError && <p className="text-xs text-destructive">Không tải được phụ thuộc. <button type="button" className="underline" onClick={() => void dependenciesQuery.refetch()}>Thử lại</button></p>}
            {(dependenciesQuery.data ?? []).map((dependency) => <DependencyRow key={dependency.id}
              blockingTaskId={dependency.blocking_task_id} disabled={saving}
              onRemove={() => void run(() => removeDependency(taskId, dependency.id), "Đã gỡ phụ thuộc.", [["dependencies", taskId]])} />)}
            <div className="space-y-2">
              <input className={fieldClass} type="search" value={blockerSearch} onChange={(event) => { setBlockerSearch(event.target.value); setBlockingId(""); setBlockerTitle(""); }} placeholder="Tìm task cần hoàn thành trước" aria-label="Tìm task chặn" />
              {blockerSearch.trim().length >= 2 && !blockingId && <div className="max-h-36 overflow-y-auto rounded-lg border border-border">
                {(blockerOptions.data ?? []).filter((option) => option.id !== taskId).map((option) => <button key={option.id} type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary" onClick={() => { setBlockingId(option.id); setBlockerTitle(option.title); setBlockerSearch(option.title); }}>{option.title}</button>)}
                {blockerOptions.isSuccess && blockerOptions.data?.filter((option) => option.id !== taskId).length === 0 && <p className="p-3 text-xs text-muted-foreground">Không tìm thấy task phù hợp.</p>}
              </div>}
              {blockingId && <p className="text-xs text-muted-foreground">Đã chọn: {blockerTitle}</p>}
              <button type="button" className={smallButton} disabled={saving || !blockingId} onClick={() => void run(() => createDependency(taskId, blockingId), "Đã thêm phụ thuộc.", [["dependencies", taskId]]).then((saved) => { if (saved) { setBlockingId(""); setBlockerSearch(""); setBlockerTitle(""); } })}>Thêm phụ thuộc</button>
            </div>
          </section>
        </>}
        {tab === "recurrence" && <section className="space-y-3"><h3 className="font-semibold">Quy tắc lặp</h3>
          <p className="text-xs text-muted-foreground">Quy tắc tạo các lần thực hiện riêng; hoàn thành lần này không kết thúc task lặp.</p>
          <RecurrenceEditor taskId={taskId} isRecurring={task.is_recurring} timezone={timezone} onRuleChanged={onClose} />
        </section>}
      </div>
    </aside>
  </div>;
}

export function TaskDetailPanel({ item, onClose }: TaskDetailPanelProps) {
  if (!item) return null;
  return <PanelContent key={item.id} item={item} onClose={onClose} />;
}
