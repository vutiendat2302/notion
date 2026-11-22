"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";

import { computeDraggedGridCell, computeResizedGridBounds } from "@/features/dashboards/canvas-utils";
import {
  createDefaultSlot,
  moveSlotInInternalGrid,
  type CardSlot,
  type CardSlotKind,
  type SlotTone,
} from "@/features/dashboards/card-slots";
import { cn } from "@/lib/utils";

const SLOT_PALETTE: ReadonlyArray<{ kind: CardSlotKind; labelVi: string; labelEn: string }> = [
  { kind: "HEADING", labelVi: "+ Tiêu đề", labelEn: "+ Heading" },
  { kind: "BADGE", labelVi: "+ Nhãn", labelEn: "+ Badge" },
  { kind: "TEXT", labelVi: "+ Văn bản", labelEn: "+ Text" },
  { kind: "FIELD", labelVi: "+ Ô nhập Form", labelEn: "+ Form Field" },
  { kind: "CHECKLIST", labelVi: "+ Checklist", labelEn: "+ Checklist" },
  { kind: "PROGRESS", labelVi: "+ Tiến độ %", labelEn: "+ Progress" },
  { kind: "DIVIDER", labelVi: "+ Đường kẻ", labelEn: "+ Divider" },
];

const TONE_PREVIEW: Record<SlotTone, string> = {
  default: "bg-background/70",
  blue: "bg-[#5D83BB]/15",
  lavender: "bg-[#A99ADB]/18",
  sage: "bg-[#8CB9A5]/18",
  peach: "bg-[#F0B28D]/18",
  rose: "bg-[#E6A0B0]/18",
  butter: "bg-[#E6C879]/20",
};

export function CardLayoutStudio({
  slots,
  internalCols,
  locale,
  onChange,
}: {
  slots: CardSlot[];
  internalCols: number;
  locale: "vi" | "en";
  onChange: (nextSlots: CardSlot[], nextCols: number) => void;
}) {
  const safeCols = Math.max(1, Math.min(4, internalCols || 2));
  const internalGridRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(slots[0]?.id ?? null);
  const [dragState, setDragState] = useState<{
    id: string;
    dx: number;
    dy: number;
    targetCol: number;
    targetRow: number;
    spanCols: number;
    rowSpan: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    id: string;
    cols: number;
    rows: number;
  } | null>(null);

  const maxRowBottom = slots.reduce((m, s) => Math.max(m, s.row + s.row_span), 1);
  const gridRows = Math.max(4, maxRowBottom + 1, dragState ? dragState.targetRow + dragState.rowSpan : 1);
  const selectedSlot = slots.find((s) => s.id === selectedId) ?? slots[0] ?? null;

  function patchSlot(id: string, patch: Partial<CardSlot>) {
    onChange(
      slots.map((s) => {
        if (s.id !== id) return s;
        const merged = { ...s, ...patch };
        const span = Math.min(safeCols, Math.max(1, merged.col_span));
        const col = Math.min(Math.max(0, merged.col), Math.max(0, safeCols - span));
        return { ...merged, col_span: span, col, row: Math.max(0, merged.row) };
      }),
      safeCols
    );
  }

  function addSlot(kind: CardSlotKind) {
    const nextRow = slots.reduce((m, s) => Math.max(m, s.row + s.row_span), 0);
    const created = createDefaultSlot(kind, nextRow, 0, kind === "HEADING" ? safeCols : 1);
    onChange([...slots, created], safeCols);
    setSelectedId(created.id);
  }

  function removeSlot(id: string) {
    const remaining = slots.filter((s) => s.id !== id);
    onChange(remaining, safeCols);
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? null);
    }
  }

  function startSlotDrag(
    e: React.PointerEvent<HTMLElement>,
    slot: CardSlot,
    spanCols: number
  ) {
    if ((e.target as HTMLElement).closest("button,input,select")) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(slot.id);

    const gridEl = internalGridRef.current;
    const slotEl = e.currentTarget.closest("[data-card-slot-id]") as HTMLElement | null;
    if (!gridEl || !slotEl) return;

    const gridRect = gridEl.getBoundingClientRect();
    const slotRect = slotEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const grabOffsetX = startX - slotRect.left;
    const grabOffsetY = startY - slotRect.top;

    let latest = { col: slot.col, row: slot.row };
    setDragState({
      id: slot.id,
      dx: 0,
      dy: 0,
      targetCol: slot.col,
      targetRow: slot.row,
      spanCols,
      rowSpan: slot.row_span,
    });

    const onMove = (ev: PointerEvent) => {
      const next = computeDraggedGridCell({
        clientX: ev.clientX,
        clientY: ev.clientY,
        grabOffsetX,
        grabOffsetY,
        gridLeft: gridRect.left,
        gridTop: gridRect.top,
        gridWidth: gridRect.width,
        gridCols: safeCols,
        spanCols,
        rowUnitPx: 54,
        gapPx: 8,
      });
      latest = next;
      setDragState({
        id: slot.id,
        dx: ev.clientX - startX,
        dy: ev.clientY - startY,
        targetCol: next.col,
        targetRow: next.row,
        spanCols,
        rowSpan: slot.row_span,
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragState(null);
      if (latest.col !== slot.col || latest.row !== slot.row) {
        onChange(
          moveSlotInInternalGrid(slots, slot.id, latest.col, latest.row, safeCols),
          safeCols
        );
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startSlotResize(
    e: React.PointerEvent<HTMLButtonElement>,
    slot: CardSlot,
    axis: "x" | "y" | "both"
  ) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(slot.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startSpanCols = Math.min(safeCols, Math.max(1, slot.col_span));
    const startRows = Math.max(1, Math.min(6, slot.row_span));
    const containerWidth = internalGridRef.current?.clientWidth || 520;

    let latest = { nextSpanCols: startSpanCols, nextRows: startRows };
    setResizeState({ id: slot.id, cols: startSpanCols, rows: startRows });

    const onMove = (ev: PointerEvent) => {
      const dx = axis === "y" ? 0 : ev.clientX - startX;
      const dy = axis === "x" ? 0 : ev.clientY - startY;
      const res = computeResizedGridBounds({
        startSpanCols,
        startRows,
        deltaX: dx,
        deltaY: dy,
        gridCols: safeCols,
        containerWidth,
        rowUnitPx: 54,
      });
      latest = {
        nextSpanCols: res.nextSpanCols,
        nextRows: Math.min(6, res.nextRows),
      };
      setResizeState({ id: slot.id, cols: latest.nextSpanCols, rows: latest.nextRows });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizeState(null);
      patchSlot(slot.id, { col_span: latest.nextSpanCols, row_span: latest.nextRows });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Top Toolbar: Internal Column Count + Component Palette */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/70 p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-muted-foreground">
            {locale === "en" ? "Card Grid:" : "Lưới bên trong Card:"}
          </span>
          {[1, 2, 3, 4].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                const clamped = slots.map((s) => {
                  const span = Math.min(c, Math.max(1, s.col_span));
                  return {
                    ...s,
                    col_span: span,
                    col: Math.min(s.col, Math.max(0, c - span)),
                  };
                });
                onChange(clamped, c);
              }}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium",
                safeCols === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {c} {locale === "en" ? "col" : "cột"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {SLOT_PALETTE.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => addSlot(item.kind)}
              className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary"
            >
              {locale === "en" ? item.labelEn : item.labelVi}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Left = Interactive Pointer Drag & Resize Grid, Right = Slot Inspector */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-xl border border-border bg-background/50 p-3">
          <p className="mb-2 text-[11px] text-muted-foreground">
            {locale === "en"
              ? "Drag parts onto any cell or drag corners/edges to resize inside the card."
              : "Kéo trực tiếp thành phần tới bất kỳ ô/hàng nào, hoặc kéo cạnh/góc của thành phần để phóng to/thu nhỏ."}
          </p>

          <div
            ref={internalGridRef}
            style={{
              gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridRows}, minmax(54px, auto))`,
            }}
            className="relative grid gap-2 select-none"
          >
            {/* Background Grid Cells (1:1 visual drop target footprint) */}
            {Array.from({ length: gridRows }, (_, rIdx) =>
              Array.from({ length: safeCols }, (_, cIdx) => {
                const isFootprint =
                  Boolean(dragState) &&
                  dragState !== null &&
                  cIdx >= dragState.targetCol &&
                  cIdx < dragState.targetCol + dragState.spanCols &&
                  rIdx >= dragState.targetRow &&
                  rIdx < dragState.targetRow + dragState.rowSpan;

                return (
                  <div
                    key={`slot-cell-${rIdx}-${cIdx}`}
                    style={{ gridColumn: `${cIdx + 1} / span 1`, gridRow: `${rIdx + 1} / span 1` }}
                    className={cn(
                      "z-0 min-h-[54px] rounded-lg border border-dashed transition-colors",
                      isFootprint
                        ? "border-primary bg-primary/20"
                        : "border-border/40 bg-secondary/10"
                    )}
                  />
                );
              })
            )}

            {/* Draggable & Resizable Card Slots */}
            {slots.map((slot) => {
              const activeDrag = dragState?.id === slot.id ? dragState : null;
              const activeResize = resizeState?.id === slot.id ? resizeState : null;
              const span = activeResize
                ? activeResize.cols
                : Math.min(safeCols, Math.max(1, slot.col_span));
              const rowSpan = activeResize ? activeResize.rows : Math.max(1, slot.row_span);
              const colStart = Math.min(Math.max(0, slot.col), Math.max(0, safeCols - span)) + 1;
              const isSelected = selectedSlot?.id === slot.id;

              return (
                <div
                  key={slot.id}
                  data-card-slot-id={slot.id}
                  onPointerDown={(e) => startSlotDrag(e, slot, span)}
                  onClick={() => setSelectedId(slot.id)}
                  style={{
                    gridColumn: `${colStart} / span ${span}`,
                    gridRow: `${slot.row + 1} / span ${rowSpan}`,
                    ...(activeDrag
                      ? {
                          transform: `translate3d(${activeDrag.dx}px, ${activeDrag.dy}px, 0)`,
                        }
                      : {}),
                  }}
                  className={cn(
                    "group/slot relative z-10 flex cursor-grab flex-col justify-between gap-1 rounded-lg border p-2 active:cursor-grabbing",
                    !activeDrag && "transition-all",
                    TONE_PREVIEW[slot.tone],
                    isSelected
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border/80 hover:border-primary/60",
                    activeDrag && "z-30 shadow-xl ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-primary">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <span>{slot.kind}</span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {span}×{rowSpan}
                    </span>
                  </div>

                  <p className="truncate font-medium text-foreground">
                    {slot.value || slot.label}
                  </p>

                  {isSelected && (
                    <div className="flex flex-wrap items-center gap-0.5 pt-1">
                      <button
                        type="button"
                        disabled={slot.col === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          patchSlot(slot.id, { col: slot.col - 1 });
                        }}
                        className="rounded border border-border bg-card p-0.5 disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={slot.col + span >= safeCols}
                        onClick={(e) => {
                          e.stopPropagation();
                          patchSlot(slot.id, { col: slot.col + 1 });
                        }}
                        className="rounded border border-border bg-card p-0.5 disabled:opacity-30"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={slot.row === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          patchSlot(slot.id, { row: slot.row - 1 });
                        }}
                        className="rounded border border-border bg-card p-0.5 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          patchSlot(slot.id, { row: slot.row + 1 });
                        }}
                        className="rounded border border-border bg-card p-0.5"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSlot(slot.id);
                        }}
                        className="ml-auto rounded p-0.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Mouse Resize Handles inside each Card Slot */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize slot width"
                    onPointerDown={(e) => startSlotResize(e, slot, "x")}
                    className="absolute right-0 top-2 bottom-2 w-1.5 cursor-ew-resize rounded-full bg-primary/25 opacity-0 transition-opacity hover:bg-primary/70 group-hover/slot:opacity-100"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize slot height"
                    onPointerDown={(e) => startSlotResize(e, slot, "y")}
                    className="absolute left-2 right-2 bottom-0 h-1.5 cursor-ns-resize rounded-full bg-primary/25 opacity-0 transition-opacity hover:bg-primary/70 group-hover/slot:opacity-100"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize slot corner"
                    onPointerDown={(e) => startSlotResize(e, slot, "both")}
                    className="absolute right-0.5 bottom-0.5 h-3 w-3 cursor-nwse-resize rounded-br border-b-2 border-r-2 border-primary/70 opacity-0 transition-opacity hover:border-primary group-hover/slot:opacity-100"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Selected Slot Inspector */}
        <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
          {selectedSlot ? (
            <>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-foreground">
                  {locale === "en" ? "Element Properties" : "Thuộc tính thành phần"}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                  {selectedSlot.kind}
                </span>
              </div>

              <label className="grid gap-1 font-medium">
                {locale === "en" ? "Label" : "Nhãn hiển thị"}
                <input
                  value={selectedSlot.label}
                  onChange={(e) => patchSlot(selectedSlot.id, { label: e.target.value })}
                  className="h-8 rounded border border-input bg-background px-2"
                />
              </label>

              {selectedSlot.kind !== "DIVIDER" && selectedSlot.kind !== "CHECKLIST" && (
                <label className="grid gap-1 font-medium">
                  {selectedSlot.kind === "PROGRESS"
                    ? "Phần trăm mặc định (0–100)"
                    : locale === "en"
                      ? "Default Value"
                      : "Nội dung mặc định"}
                  <input
                    value={selectedSlot.value ?? ""}
                    onChange={(e) => patchSlot(selectedSlot.id, { value: e.target.value })}
                    className="h-8 rounded border border-input bg-background px-2"
                  />
                </label>
              )}

              {(selectedSlot.kind === "FIELD" || selectedSlot.kind === "TEXT") && (
                <label className="grid gap-1 font-medium">
                  Placeholder
                  <input
                    value={selectedSlot.placeholder ?? ""}
                    onChange={(e) => patchSlot(selectedSlot.id, { placeholder: e.target.value })}
                    className="h-8 rounded border border-input bg-background px-2"
                  />
                </label>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 font-medium">
                  Chiếm cột (Width)
                  <select
                    value={selectedSlot.col_span}
                    onChange={(e) =>
                      patchSlot(selectedSlot.id, { col_span: Number(e.target.value) })
                    }
                    className="h-8 rounded border border-input bg-background px-2"
                  >
                    {Array.from({ length: safeCols }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        {c} / {safeCols} cột
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 font-medium">
                  Số hàng (Height)
                  <select
                    value={selectedSlot.row_span}
                    onChange={(e) =>
                      patchSlot(selectedSlot.id, { row_span: Number(e.target.value) })
                    }
                    className="h-8 rounded border border-input bg-background px-2"
                  >
                    {[1, 2, 3, 4, 5, 6].map((r) => (
                      <option key={r} value={r}>
                        {r} hàng
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 font-medium">
                  Căn lề
                  <select
                    value={selectedSlot.align}
                    onChange={(e) =>
                      patchSlot(selectedSlot.id, {
                        align: e.target.value as CardSlot["align"],
                      })
                    }
                    className="h-8 rounded border border-input bg-background px-2"
                  >
                    <option value="left">Trái</option>
                    <option value="center">Giữa</option>
                    <option value="right">Phải</option>
                  </select>
                </label>

                <label className="grid gap-1 font-medium">
                  Cỡ chữ
                  <select
                    value={selectedSlot.font_size}
                    onChange={(e) =>
                      patchSlot(selectedSlot.id, {
                        font_size: e.target.value as CardSlot["font_size"],
                      })
                    }
                    className="h-8 rounded border border-input bg-background px-2"
                  >
                    <option value="xs">Nhỏ (XS)</option>
                    <option value="sm">Vừa (SM)</option>
                    <option value="base">Lớn (Base)</option>
                    <option value="lg">Tiêu đề (LG)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 items-end gap-2">
                <label className="grid gap-1 font-medium">
                  Màu nền ô
                  <select
                    value={selectedSlot.tone}
                    onChange={(e) =>
                      patchSlot(selectedSlot.id, { tone: e.target.value as SlotTone })
                    }
                    className="h-8 rounded border border-input bg-background px-2"
                  >
                    <option value="default">Mặc định</option>
                    <option value="blue">Soft Blue</option>
                    <option value="lavender">Lavender</option>
                    <option value="sage">Sage</option>
                    <option value="peach">Peach</option>
                    <option value="rose">Rose</option>
                    <option value="butter">Butter</option>
                  </select>
                </label>

                <label className="flex h-8 cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedSlot.bordered)}
                    onChange={(e) => patchSlot(selectedSlot.id, { bordered: e.target.checked })}
                    className="accent-primary"
                  />
                  <span>Viền riêng ô</span>
                </label>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-36 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <p>Chưa có thành phần nào bên trong Card.</p>
              <button
                type="button"
                onClick={() => addSlot("HEADING")}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm tiêu đề đầu tiên</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
