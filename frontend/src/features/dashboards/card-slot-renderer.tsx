"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import type { CardSlot, CardSlotChecklistItem, SlotTone } from "@/features/dashboards/card-slots";
import { cn } from "@/lib/utils";

const SLOT_TONE_CLASSES: Record<SlotTone, string> = {
  default: "",
  blue: "bg-[#5D83BB]/12 text-[#5D83BB] dark:text-[#8DB5F0]",
  lavender: "bg-[#A99ADB]/15 text-[#7F6EC2] dark:text-[#C4B9EE]",
  sage: "bg-[#8CB9A5]/15 text-[#4E856C] dark:text-[#9FD1BA]",
  peach: "bg-[#F0B28D]/16 text-[#B66E45] dark:text-[#F4C4A5]",
  rose: "bg-[#E6A0B0]/16 text-[#AC586C] dark:text-[#F0B5C2]",
  butter: "bg-[#E6C879]/18 text-[#967725] dark:text-[#EED794]",
};

export function CardSlotRenderer({
  slots,
  internalCols,
  locale,
  onSlotsChange,
}: {
  slots: CardSlot[];
  internalCols: number;
  locale: "vi" | "en";
  onSlotsChange: (nextSlots: CardSlot[]) => void;
}) {
  const [newCheckDrafts, setNewCheckDrafts] = useState<Record<string, string>>({});
  const safeCols = Math.max(1, Math.min(4, internalCols || 2));
  const maxRowBottom = slots.reduce((m, s) => Math.max(m, s.row + s.row_span), 1);

  function patchSlot(slotId: string, patch: Partial<CardSlot>) {
    onSlotsChange(slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)));
  }

  return (
    <div
      style={{
        gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${maxRowBottom}, minmax(36px, auto))`,
      }}
      className="grid gap-2.5"
    >
      {slots.map((slot) => {
        const span = Math.min(safeCols, Math.max(1, slot.col_span));
        const colStart = Math.min(Math.max(0, slot.col), Math.max(0, safeCols - span)) + 1;
        const alignCls =
          slot.align === "center"
            ? "text-center items-center"
            : slot.align === "right"
              ? "text-right items-end"
              : "text-left items-start";
        const textSizeCls =
          slot.font_size === "xs"
            ? "text-xs"
            : slot.font_size === "lg"
              ? "text-lg font-bold"
              : slot.font_size === "base"
                ? "text-base font-semibold"
                : "text-sm";

        return (
          <div
            key={slot.id}
            style={{
              gridColumn: `${colStart} / span ${span}`,
              gridRow: `${slot.row + 1} / span ${Math.max(1, slot.row_span)}`,
            }}
            className={cn(
              "flex flex-col justify-center rounded-lg px-2 py-1.5",
              SLOT_TONE_CLASSES[slot.tone],
              slot.bordered && "border border-border/70 bg-background/60",
              alignCls
            )}
          >
            {slot.kind === "HEADING" && (
              <input
                defaultValue={slot.value ?? slot.label}
                onBlur={(e) => {
                  if (e.target.value !== (slot.value ?? "")) {
                    patchSlot(slot.id, { value: e.target.value });
                  }
                }}
                className={cn(
                  "w-full bg-transparent text-foreground outline-none",
                  textSizeCls,
                  slot.align === "center"
                    ? "text-center"
                    : slot.align === "right"
                      ? "text-right"
                      : "text-left"
                )}
              />
            )}

            {slot.kind === "BADGE" && (
              <input
                defaultValue={slot.value ?? slot.label}
                onBlur={(e) => {
                  if (e.target.value !== (slot.value ?? "")) {
                    patchSlot(slot.id, { value: e.target.value });
                  }
                }}
                className={cn(
                  "inline-flex w-fit max-w-full rounded-full bg-background/70 px-2.5 py-0.5 text-[11px] font-semibold outline-none",
                  slot.align === "center"
                    ? "text-center"
                    : slot.align === "right"
                      ? "text-right"
                      : "text-left"
                )}
              />
            )}

            {slot.kind === "TEXT" && (
              <textarea
                rows={Math.max(2, slot.row_span)}
                defaultValue={slot.value ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (slot.value ?? "")) {
                    patchSlot(slot.id, { value: e.target.value });
                  }
                }}
                placeholder={slot.placeholder || slot.label}
                className={cn(
                  "w-full resize-none bg-transparent leading-relaxed text-foreground outline-none",
                  textSizeCls,
                  slot.align === "center"
                    ? "text-center"
                    : slot.align === "right"
                      ? "text-right"
                      : "text-left"
                )}
              />
            )}

            {slot.kind === "FIELD" && (
              <label className="grid w-full gap-1 text-left text-[11px] font-medium text-muted-foreground">
                <span>{slot.label}</span>
                <input
                  defaultValue={slot.value ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (slot.value ?? "")) {
                      patchSlot(slot.id, { value: e.target.value });
                    }
                  }}
                  placeholder={slot.placeholder || "..."}
                  className="h-8 w-full rounded-md border border-input bg-background/80 px-2 text-xs font-normal text-foreground outline-none focus:border-primary"
                />
              </label>
            )}

            {slot.kind === "PROGRESS" && (() => {
              const pct = Math.min(100, Math.max(0, Number(slot.value ?? 0) || 0));
              return (
                <div className="w-full space-y-1.5 text-left">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-medium">
                    <span>{slot.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={pct}
                      onBlur={(e) => {
                        const clamped = String(
                          Math.min(100, Math.max(0, Number(e.target.value) || 0))
                        );
                        if (clamped !== (slot.value ?? "0")) {
                          patchSlot(slot.id, { value: clamped });
                        }
                      }}
                      className="w-12 rounded border border-input bg-background/80 px-1 text-right font-mono text-[11px] text-foreground outline-none"
                    />
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-primary transition-all"
                    />
                  </div>
                </div>
              );
            })()}

            {slot.kind === "CHECKLIST" && (
              <div className="w-full space-y-1.5 text-left text-xs">
                <p className="font-semibold text-foreground">{slot.label}</p>
                {(slot.items ?? []).map((item: CardSlotChecklistItem) => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) => {
                          const nextItems = (slot.items ?? []).map((x) =>
                            x.id === item.id ? { ...x, done: e.target.checked } : x
                          );
                          patchSlot(slot.id, { items: nextItems });
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className={item.done ? "line-through text-muted-foreground" : ""}>
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        patchSlot(slot.id, {
                          items: (slot.items ?? []).filter((x) => x.id !== item.id),
                        })
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const txt = (newCheckDrafts[slot.id] ?? "").trim();
                    if (!txt) return;
                    patchSlot(slot.id, {
                      items: [
                        ...(slot.items ?? []),
                        { id: String(Date.now()), text: txt, done: false },
                      ],
                    });
                    setNewCheckDrafts((p) => ({ ...p, [slot.id]: "" }));
                  }}
                  className="flex gap-1 pt-0.5"
                >
                  <input
                    value={newCheckDrafts[slot.id] ?? ""}
                    onChange={(e) =>
                      setNewCheckDrafts((p) => ({ ...p, [slot.id]: e.target.value }))
                    }
                    placeholder={locale === "en" ? "+ Item..." : "+ Thêm việc..."}
                    className="h-7 flex-1 rounded border border-input bg-background/70 px-2 text-xs outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-7 items-center rounded border border-border px-2 text-xs hover:bg-secondary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </form>
              </div>
            )}

            {slot.kind === "DIVIDER" && <hr className="w-full border-border/80" />}
          </div>
        );
      })}
    </div>
  );
}
