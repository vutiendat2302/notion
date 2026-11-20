"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { confirmRollover, previewRollover, type RolloverAction } from "@/features/planning/api";
import type { PeriodType } from "@/types/domain";

interface Props {
  type: PeriodType;
  periodKey: string;
  onClose: () => void;
}

export function RolloverDialog({ type, periodKey, onClose }: Props) {
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const requestKey = useRef<string | null>(null);
  const [action, setAction] = useState<RolloverAction>("PIN");
  const [selected, setSelected] = useState<string[]>([]);
  const preview = useQuery({
    queryKey: ["rollover-preview", type, periodKey, action],
    queryFn: () => previewRollover(type, periodKey, action),
  });

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!preview.data) throw new Error("Chưa tải được danh sách chuyển kỳ.");
      requestKey.current ??= crypto.randomUUID();
      return confirmRollover(preview.data, selected, requestKey.current);
    },
    onSuccess: async ({ processed_count }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["planning-period"] }),
        queryClient.invalidateQueries({ queryKey: ["occurrence-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["occurrences"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      ]);
      toast.success(`Đã chuyển ${processed_count} mục sang kỳ sau.`);
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Không chuyển được kỳ. Tải lại và thử tiếp.");
      void preview.refetch();
    },
  });

  return <div role="dialog" aria-modal="true" aria-label="Xác nhận chuyển kỳ" className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
    <section className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-5 shadow-xl">
      <h2 className="text-lg font-semibold">Chuyển mục sang kỳ sau</h2>
      <p className="mt-1 text-sm text-muted-foreground">Chọn hành động và những lần thực hiện còn chờ. Thao tác được lưu cùng một giao dịch.</p>
      <fieldset className="mt-4 flex gap-4 text-sm">
        <legend className="mb-2 font-medium">Hành động</legend>
        <label className="flex items-center gap-2"><input type="radio" checked={action === "PIN"} onChange={() => { setAction("PIN"); setSelected([]); requestKey.current = null; }} /> Ghim vào kế hoạch sau</label>
        <label className="flex items-center gap-2"><input type="radio" checked={action === "RESCHEDULE"} onChange={() => { setAction("RESCHEDULE"); setSelected([]); requestKey.current = null; }} /> Dời lịch</label>
      </fieldset>
      {preview.isLoading && <p className="mt-4 text-sm text-muted-foreground" aria-busy="true">Đang xem trước…</p>}
      {preview.isError && <p className="mt-4 text-sm text-destructive">Không tải được danh sách. <button type="button" onClick={() => void preview.refetch()} className="underline">Thử lại</button></p>}
      {preview.data && <>
        <p className="mt-4 text-xs text-muted-foreground">Kỳ sau: {preview.data.target_period_key} · bắt đầu {preview.data.target_start_date}</p>
        {preview.data.candidates.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Không có mục đủ điều kiện chuyển kỳ.</p> :
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{preview.data.candidates.map((item) => <label key={item.occurrence_id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <input type="checkbox" checked={selected.includes(item.occurrence_id)} onChange={(event) => { requestKey.current = null; setSelected((current) => event.target.checked ? [...current, item.occurrence_id] : current.filter((id) => id !== item.occurrence_id)); }} />
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.proposed_date}</span>
          </label>)}</div>}
      </>}
      {action === "RESCHEDULE" && <p className="mt-3 text-xs text-muted-foreground">Lịch sử đã hoàn thành được giữ nguyên. Lịch có giờ sẽ giữ giờ bắt đầu và thời lượng.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button ref={cancelRef} type="button" onClick={onClose} className="min-h-10 rounded-lg border border-border px-4 text-sm">Hủy</button>
        <button type="button" disabled={!preview.data || selected.length === 0 || mutation.isPending} onClick={() => mutation.mutate()} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{mutation.isPending ? "Đang chuyển…" : `Chuyển ${selected.length} mục`}</button>
      </div>
    </section>
  </div>;
}
