export type CardSlotKind =
  | "HEADING"
  | "BADGE"
  | "TEXT"
  | "FIELD"
  | "CHECKLIST"
  | "PROGRESS"
  | "DIVIDER";

export type SlotTone = "default" | "blue" | "lavender" | "sage" | "peach" | "rose" | "butter";

export interface CardSlotChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CardSlot {
  id: string;
  kind: CardSlotKind;
  label: string;
  value?: string;
  placeholder?: string;
  items?: CardSlotChecklistItem[];
  col: number;
  row: number;
  col_span: number;
  row_span: number;
  align: "left" | "center" | "right";
  font_size: "xs" | "sm" | "base" | "lg";
  tone: SlotTone;
  bordered?: boolean;
}

export function createDefaultSlot(
  kind: CardSlotKind,
  row: number,
  col = 0,
  colSpan = 1
): CardSlot {
  const id = `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  switch (kind) {
    case "HEADING":
      return {
        id,
        kind,
        label: "Tiêu đề",
        value: "Tiêu đề phần",
        col,
        row,
        col_span: colSpan,
        row_span: 1,
        align: "left",
        font_size: "lg",
        tone: "default",
      };
    case "BADGE":
      return {
        id,
        kind,
        label: "Nhãn",
        value: "Active",
        col,
        row,
        col_span: colSpan,
        row_span: 1,
        align: "left",
        font_size: "xs",
        tone: "blue",
      };
    case "TEXT":
      return {
        id,
        kind,
        label: "Mô tả",
        value: "Nội dung ghi chú...",
        col,
        row,
        col_span: colSpan,
        row_span: 1,
        align: "left",
        font_size: "sm",
        tone: "default",
      };
    case "FIELD":
      return {
        id,
        kind,
        label: "Trường nhập liệu",
        value: "",
        placeholder: "Nhập giá trị...",
        col,
        row,
        col_span: colSpan,
        row_span: 1,
        align: "left",
        font_size: "sm",
        tone: "default",
        bordered: true,
      };
    case "CHECKLIST":
      return {
        id,
        kind,
        label: "Checklist",
        items: [{ id: "1", text: "Việc cần làm", done: false }],
        col,
        row,
        col_span: colSpan,
        row_span: 1,
        align: "left",
        font_size: "sm",
        tone: "default",
      };
    case "PROGRESS":
      return {
        id,
        kind,
        label: "Tiến độ",
        value: "50",
        col,
        row,
        col_span: colSpan,
        row_span: 1,
        align: "left",
        font_size: "sm",
        tone: "sage",
      };
    case "DIVIDER":
      return {
        id,
        kind,
        label: "Đường kẻ",
        col,
        row,
        col_span: colSpan,
        row_span: 1,
        align: "left",
        font_size: "xs",
        tone: "default",
      };
  }
}

export function extractSlotsFromSpec(
  spec: Record<string, unknown>,
  fallbackTitle: string
): CardSlot[] {
  if (Array.isArray(spec.card_slots) && spec.card_slots.length > 0) {
    return (spec.card_slots as CardSlot[]).map((s, idx) => ({
      ...s,
      col: Math.max(0, Number(s.col ?? 0)),
      row: Math.max(0, Number(s.row ?? idx)),
      col_span: Math.max(1, Number(s.col_span ?? 1)),
      row_span: Math.max(1, Number(s.row_span ?? 1)),
      align: s.align ?? "left",
      font_size: s.font_size ?? "sm",
      tone: s.tone ?? "default",
    }));
  }

  // Convert legacy simple card/form spec cleanly into editable internal slots
  const preset = String(spec.preset_type ?? "");
  const content = typeof spec.content === "string" ? spec.content : "";
  if (preset === "CHECKLIST" && Array.isArray(spec.items)) {
    return [
      {
        id: "slot-head",
        kind: "HEADING",
        label: "Tiêu đề",
        value: fallbackTitle,
        col: 0,
        row: 0,
        col_span: 2,
        row_span: 1,
        align: "left",
        font_size: "base",
        tone: "default",
      },
      {
        id: "slot-list",
        kind: "CHECKLIST",
        label: "Danh sách",
        items: spec.items as CardSlotChecklistItem[],
        col: 0,
        row: 1,
        col_span: 2,
        row_span: 1,
        align: "left",
        font_size: "sm",
        tone: "default",
      },
    ];
  }

  return [
    {
      id: "slot-head",
      kind: "HEADING",
      label: "Tiêu đề",
      value: fallbackTitle || "Card Title",
      col: 0,
      row: 0,
      col_span: 2,
      row_span: 1,
      align: "left",
      font_size: "lg",
      tone: "default",
    },
    {
      id: "slot-body",
      kind: "TEXT",
      label: "Nội dung",
      value: content || "Nội dung card...",
      col: 0,
      row: 1,
      col_span: 2,
      row_span: 1,
      align: "left",
      font_size: "sm",
      tone: "default",
    },
  ];
}

export function moveSlotInInternalGrid(
  slots: CardSlot[],
  slotId: string,
  targetCol: number,
  targetRow: number,
  internalCols: number
): CardSlot[] {
  return slots.map((s) => {
    if (s.id !== slotId) return s;
    const span = Math.min(internalCols, Math.max(1, s.col_span));
    const col = Math.min(Math.max(0, targetCol), Math.max(0, internalCols - span));
    const row = Math.max(0, targetRow);
    return { ...s, col, row, col_span: span };
  });
}
