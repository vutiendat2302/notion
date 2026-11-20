"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { dateInTimeZone } from "@/features/planning/period";
import {
  createRecurrence,
  fetchRecurrence,
  fetchRecurrencePreview,
  setRecurrencePaused,
  updateFutureRecurrence,
} from "@/features/tasks/api";
import { ApiClientError } from "@/lib/api/client";
import type { RecurrenceRule, RecurrenceRuleInput } from "@/types/domain";

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const fieldClass = "min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary";

function initialRule(rule: RecurrenceRule | undefined, timezone: string): RecurrenceRuleInput {
  return {
    frequency: rule?.frequency ?? "DAILY",
    interval_value: rule?.interval_value ?? 1,
    weekdays_mask: rule?.weekdays_mask ?? null,
    month_day: rule?.month_day ?? null,
    monthly_overflow_policy: rule?.monthly_overflow_policy ?? "SKIP",
    default_start_time: rule?.default_start_time ?? null,
    default_duration_minutes: rule?.default_duration_minutes ?? null,
    starts_on: rule?.starts_on ?? dateInTimeZone(new Date(), timezone),
    ends_on: rule?.ends_on ?? null,
    max_count: rule?.max_count ?? null,
    timezone: rule?.timezone ?? timezone,
  };
}

function RuleForm({ taskId, rule, timezone, onRuleChanged }: { taskId: string; rule?: RecurrenceRule; timezone: string; onRuleChanged: () => void }) {
  const queryClient = useQueryClient();
  const today = dateInTimeZone(new Date(), rule?.timezone ?? timezone);
  const [form, setForm] = useState<RecurrenceRuleInput>(() => initialRule(rule, timezone));
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [confirmFuture, setConfirmFuture] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (form.ends_on && form.ends_on < form.starts_on) throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
      if (form.default_duration_minutes && !form.default_start_time) throw new Error("Chọn giờ bắt đầu trước khi nhập thời lượng.");
      if (rule) {
        if (!confirmFuture) throw new Error("Xác nhận phạm vi sửa các lần tương lai.");
        if (effectiveDate < today || form.starts_on > effectiveDate) throw new Error("Ngày áp dụng phải từ hôm nay và không trước ngày bắt đầu.");
        return updateFutureRecurrence(taskId, { ...form, effective_date: effectiveDate, expected_rule_version: rule.rule_version });
      }
      return createRecurrence(taskId, form);
    },
    onSuccess: async () => {
      toast.success(rule ? "Đã cập nhật các lần tương lai." : "Đã tạo quy tắc lặp.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recurrence", taskId] }),
        queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
        queryClient.invalidateQueries({ queryKey: ["occurrences"] }),
        queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] }),
      ]);
      onRuleChanged();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không lưu được quy tắc lặp."),
  });

  return <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <div className="grid grid-cols-2 gap-3">
      <label className="space-y-1 text-xs text-muted-foreground">Chu kỳ
        <select className={fieldClass} value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as RecurrenceRuleInput["frequency"], weekdays_mask: null, month_day: null })}>
          <option value="DAILY">Hằng ngày</option><option value="WEEKLY">Hằng tuần</option><option value="MONTHLY">Hằng tháng</option><option value="YEARLY">Hằng năm</option>
        </select>
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">Lặp mỗi
        <input className={fieldClass} type="number" min="1" max="365" value={form.interval_value} onChange={(event) => setForm({ ...form, interval_value: Number(event.target.value) })} required />
      </label>
    </div>
    {form.frequency === "WEEKLY" && <fieldset>
      <legend className="mb-2 text-xs text-muted-foreground">Các ngày trong tuần</legend>
      <div className="flex flex-wrap gap-1.5">{weekdays.map((day, index) => {
        const checked = Boolean((form.weekdays_mask ?? 0) & (1 << index));
        return <label key={day} className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs ${checked ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}>
          <input type="checkbox" className="sr-only" checked={checked} onChange={() => {
            const next = (form.weekdays_mask ?? 0) ^ (1 << index);
            setForm({ ...form, weekdays_mask: next || null });
          }} />{day}
        </label>;
      })}</div>
      <p className="mt-1 text-xs text-muted-foreground">Không chọn ngày nào: dùng thứ của ngày bắt đầu.</p>
    </fieldset>}
    {form.frequency === "MONTHLY" && <div className="grid grid-cols-2 gap-3">
      <label className="space-y-1 text-xs text-muted-foreground">Ngày trong tháng
        <input className={fieldClass} type="number" min="1" max="31" placeholder="Theo ngày bắt đầu" value={form.month_day ?? ""} onChange={(event) => setForm({ ...form, month_day: event.target.value ? Number(event.target.value) : null })} />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">Tháng thiếu ngày
        <select className={fieldClass} value={form.monthly_overflow_policy} onChange={(event) => setForm({ ...form, monthly_overflow_policy: event.target.value as RecurrenceRuleInput["monthly_overflow_policy"] })}>
          <option value="SKIP">Bỏ qua</option><option value="CLAMP_TO_LAST_DAY">Dùng ngày cuối</option>
        </select>
      </label>
    </div>}
    <div className="grid grid-cols-2 gap-3">
      <label className="space-y-1 text-xs text-muted-foreground">Bắt đầu
        <input className={fieldClass} type="date" value={form.starts_on} onChange={(event) => setForm({ ...form, starts_on: event.target.value })} required />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">Kết thúc (tùy chọn)
        <input className={fieldClass} type="date" value={form.ends_on ?? ""} onChange={(event) => setForm({ ...form, ends_on: event.target.value || null })} />
      </label>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <label className="space-y-1 text-xs text-muted-foreground">Giờ bắt đầu (tùy chọn)
        <input className={fieldClass} type="time" value={form.default_start_time?.slice(0, 5) ?? ""} onChange={(event) => setForm({ ...form, default_start_time: event.target.value || null, default_duration_minutes: event.target.value ? form.default_duration_minutes : null })} />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">Phút
        <input className={fieldClass} type="number" min="1" max="1440" disabled={!form.default_start_time} value={form.default_duration_minutes ?? ""} onChange={(event) => setForm({ ...form, default_duration_minutes: event.target.value ? Number(event.target.value) : null })} />
      </label>
    </div>
    <label className="block space-y-1 text-xs text-muted-foreground">Tối đa số lần (tùy chọn)
      <input className={fieldClass} type="number" min="1" max="10000" value={form.max_count ?? ""} onChange={(event) => setForm({ ...form, max_count: event.target.value ? Number(event.target.value) : null })} />
    </label>
    <p className="text-xs text-muted-foreground">Múi giờ: {form.timezone}</p>
    {rule && <div className="rounded-lg bg-secondary p-3 text-xs">
      <label className="block space-y-1">Áp dụng từ ngày
        <input className={fieldClass} type="date" min={today} value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
      </label>
      <label className="mt-3 flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={confirmFuture} onChange={(event) => setConfirmFuture(event.target.checked)} />
        Tôi hiểu các lần chưa bắt đầu từ ngày này có thể được tạo lại; lịch sử đã hoàn thành được giữ nguyên.
      </label>
    </div>}
    <button type="submit" disabled={save.isPending || Boolean(rule && !confirmFuture)} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
      {save.isPending ? "Đang lưu…" : rule ? "Lưu các lần tương lai" : "Tạo quy tắc lặp"}
    </button>
  </form>;
}

export function RecurrenceEditor({ taskId, isRecurring, timezone, onRuleChanged }: { taskId: string; isRecurring: boolean; timezone: string; onRuleChanged: () => void }) {
  const queryClient = useQueryClient();
  const ruleQuery = useQuery({ queryKey: ["recurrence", taskId], queryFn: () => fetchRecurrence(taskId), enabled: isRecurring, retry: false });
  const rule = ruleQuery.data;
  const previewQuery = useQuery({ queryKey: ["recurrence-preview", taskId, rule?.rule_version], queryFn: () => fetchRecurrencePreview(taskId), enabled: Boolean(rule), retry: false });
  const pauseMutation = useMutation({
    mutationFn: () => setRecurrencePaused(taskId, !rule?.is_paused, rule!.rule_version),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["recurrence", taskId] }); toast.success(rule?.is_paused ? "Đã tiếp tục lịch lặp." : "Đã tạm dừng lịch lặp."); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không đổi được trạng thái lịch lặp."),
  });

  if (ruleQuery.isLoading) return <p className="text-sm text-muted-foreground">Đang tải quy tắc lặp…</p>;
  if (ruleQuery.isError && !(ruleQuery.error instanceof ApiClientError && ruleQuery.error.status === 404)) return <p className="text-sm text-destructive">Không tải được quy tắc lặp. <button type="button" onClick={() => void ruleQuery.refetch()} className="underline">Thử lại</button></p>;

  return <div className="space-y-4">
    {rule && <div className="rounded-lg border border-border p-3 text-xs">
      <div className="flex items-center justify-between gap-2"><span>Phiên bản {rule.rule_version} · {rule.is_paused ? "Đang tạm dừng" : "Đang hoạt động"}</span>
        <button type="button" disabled={pauseMutation.isPending} onClick={() => pauseMutation.mutate()} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-secondary disabled:opacity-50">{rule.is_paused ? "Tiếp tục" : "Tạm dừng"}</button>
      </div>
      {previewQuery.data && <p className="mt-2 text-muted-foreground">5 ngày kế tiếp: {previewQuery.data.length ? previewQuery.data.join(" · ") : "Không có"}</p>}
      {previewQuery.isError && <p className="mt-2 text-destructive">Không tải được ngày dự kiến.</p>}
    </div>}
    <RuleForm key={rule?.id ?? "new"} taskId={taskId} rule={rule} timezone={timezone} onRuleChanged={onRuleChanged} />
  </div>;
}
