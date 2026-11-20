"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { patchOccurrence } from "@/features/tasks/api";
import type { PeriodWindow } from "@/features/planning/period";
import type { OccurrenceWithTask } from "@/types/domain";

interface Props {
  source: PeriodWindow;
  target: PeriodWindow;
  items: OccurrenceWithTask[];
  onClose: () => void;
}

function movedDate(day: string, source: PeriodWindow, target: PeriodWindow): string {
  const sourceStart = Date.parse(`${source.start}T12:00:00Z`);
  const targetStart = Date.parse(`${target.start}T12:00:00Z`);
  const targetEnd = Date.parse(`${target.endExclusive}T12:00:00Z`);
  const offset = Math.round((Date.parse(`${day}T12:00:00Z`) - sourceStart) / 86_400_000);
  const targetLength = Math.round((targetEnd - targetStart) / 86_400_000);
  return new Date(targetStart + Math.min(offset, targetLength - 1) * 86_400_000)
    .toISOString().slice(0, 10);
}

export function RolloverDialog({ source, target, items, onClose }: Props) {
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState(() => items.map((item) => item.id));

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      let moved = 0;
      let failed = 0;
      for (const item of items.filter((candidate) => selected.includes(candidate.id))) {
        if (!item.scheduled_date) continue;
        try {
          await patchOccurrence(item.id, {
            scheduled_date: movedDate(item.scheduled_date, source, target),
            expected_version: item.version,
          });
          moved++;
        } catch {
          failed++;
        }
      }
      return { moved, failed };
    },
    onSuccess: async ({ moved, failed }) => {
      await queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      if (moved > 0) toast.success(`Đã chuyển ${moved} mục sang ${target.title}.`);
      if (failed > 0) toast.error(`${failed} mục chưa chuyển được. Tải lại dữ liệu và thử tiếp.`);
      onClose();
    },
  });

  return <div role="dialog" aria-modal="true" aria-label="Xác nhận chuyển kỳ"
    className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
    <section className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-5 shadow-xl">
      <h2 className="text-lg font-semibold">Chuyển sang {target.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chọn các mục cả ngày cần dời. Lịch sử hoàn thành sẽ được giữ nguyên.
      </p>
      <div className="mt-4 space-y-2">{items.map((item) => <label key={item.id}
        className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
        <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) =>
          setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))
        } />
        <span className="min-w-0 flex-1 truncate">{item.task.title}</span>
        <span className="text-xs text-muted-foreground">{item.scheduled_date}</span>
      </label>)}</div>
      <p className="mt-3 text-xs text-muted-foreground">Các mục có giờ được dời riêng trong Calendar để giữ giờ bắt đầu và kết thúc.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button ref={cancelRef} type="button" onClick={onClose} className="min-h-10 rounded-lg border border-border px-4 text-sm">Hủy</button>
        <button type="button" disabled={selected.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
          {mutation.isPending ? "Đang chuyển…" : `Chuyển ${selected.length} mục`}
        </button>
      </div>
    </section>
  </div>;
}
