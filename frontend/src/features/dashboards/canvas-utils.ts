import type { DashboardWidget } from "@/types/domain";

export interface OutlineHeading {
  id: string;
  blockId: string;
  level: 1 | 2 | 3;
  text: string;
}

export function extractMarkdownHeadings(widgets: DashboardWidget[]): OutlineHeading[] {
  const result: OutlineHeading[] = [];

  for (const w of widgets) {
    const preset = typeof w.spec_json.preset_type === "string" ? w.spec_json.preset_type : "";
    const content = typeof w.spec_json.content === "string" ? w.spec_json.content : "";

    if (preset === "TITLE" || preset === "HERO_BANNER") {
      const rawLevel = String(w.spec_json.level ?? "h1").toLowerCase();
      const level: 1 | 2 | 3 = rawLevel === "h3" ? 3 : rawLevel === "h2" ? 2 : 1;
      const text = (content || w.title || "Untitled").trim();
      if (text) {
        result.push({
          id: `${w.id}-title`,
          blockId: w.id,
          level,
          text,
        });
      }
      continue;
    }

    if (content) {
      const lines = content.split(/\r?\n/);
      lines.forEach((line, lineIdx) => {
        const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
        if (match) {
          const level = Math.min(3, Math.max(1, match[1].length)) as 1 | 2 | 3;
          const text = match[2].trim();
          if (text) {
            result.push({
              id: `${w.id}-line-${lineIdx}`,
              blockId: w.id,
              level,
              text,
            });
          }
        }
      });
    }
  }

  return result;
}

export function resolveGridSpanCols(
  widgetWidth12: number,
  specColSpan: unknown,
  gridCols: number
): number {
  if (typeof specColSpan === "number" && Number.isFinite(specColSpan) && specColSpan >= 1) {
    return Math.min(gridCols, Math.max(1, Math.round(specColSpan)));
  }
  const scaled = Math.round((Math.max(1, widgetWidth12) / 12) * gridCols);
  return Math.min(gridCols, Math.max(1, scaled));
}

export function computeResizedGridBounds(params: {
  startSpanCols: number;
  startRows: number;
  deltaX: number;
  deltaY: number;
  gridCols: number;
  containerWidth: number;
  rowUnitPx?: number;
}): { nextSpanCols: number; nextWidth12: number; nextRows: number } {
  const {
    startSpanCols,
    startRows,
    deltaX,
    deltaY,
    gridCols,
    containerWidth,
    rowUnitPx = 64,
  } = params;

  const colUnitPx = Math.max(48, containerWidth / Math.max(1, gridCols));
  const nextSpanCols = Math.min(
    gridCols,
    Math.max(1, Math.round(startSpanCols + deltaX / colUnitPx))
  );
  const nextRows = Math.min(12, Math.max(1, Math.round(startRows + deltaY / rowUnitPx)));
  const nextWidth12 = Math.min(12, Math.max(1, Math.round((nextSpanCols / gridCols) * 12)));

  return { nextSpanCols, nextWidth12, nextRows };
}

export interface SpatialCellRect {
  col: number;
  row: number;
  spanCols: number;
  rowSpan: number;
}

export function materializeSpatialLayout(
  widgets: DashboardWidget[],
  gridCols: number
): { rects: Map<string, SpatialCellRect>; totalRows: number; hasSpatial: boolean } {
  const rects = new Map<string, SpatialCellRect>();
  let curCol = 0;
  let curRow = 0;
  let curRowMaxH = 0;
  let maxRowBottom = 0;
  let hasSpatial = false;

  for (const w of widgets) {
    const spanCols = resolveGridSpanCols(w.width, w.spec_json.grid_col_span, gridCols);
    const rowSpan = Math.max(1, Math.min(12, w.height || 2));

    if (w.spec_json.grid_placed === true) {
      hasSpatial = true;
      const col = Math.min(Math.max(0, w.position_x), Math.max(0, gridCols - spanCols));
      const row = Math.max(0, w.position_y);
      rects.set(w.id, { col, row, spanCols, rowSpan });
      maxRowBottom = Math.max(maxRowBottom, row + rowSpan);
      curCol = 0;
      curRow = Math.max(curRow, row + rowSpan);
      curRowMaxH = 0;
      continue;
    }

    if (curCol + spanCols > gridCols) {
      curCol = 0;
      curRow += Math.max(1, curRowMaxH);
      curRowMaxH = 0;
    }
    const assignedCol = curCol;
    const assignedRow = Math.max(curRow, maxRowBottom > curRow ? curRow : 0);
    rects.set(w.id, { col: assignedCol, row: assignedRow, spanCols, rowSpan });
    curCol += spanCols;
    curRowMaxH = Math.max(curRowMaxH, rowSpan);
    maxRowBottom = Math.max(maxRowBottom, assignedRow + rowSpan);
  }

  return { rects, totalRows: Math.max(1, maxRowBottom), hasSpatial };
}

export function computeDraggedGridCell(params: {
  clientX: number;
  clientY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  gridLeft: number;
  gridTop: number;
  gridWidth: number;
  gridCols: number;
  spanCols: number;
  rowUnitPx?: number;
  gapPx?: number;
}): { col: number; row: number } {
  const {
    clientX,
    clientY,
    grabOffsetX,
    grabOffsetY,
    gridLeft,
    gridTop,
    gridWidth,
    gridCols,
    spanCols,
    rowUnitPx = 64,
    gapPx = 14,
  } = params;

  const colStride = Math.max(40, (gridWidth + gapPx) / Math.max(1, gridCols));
  const rowStride = rowUnitPx + gapPx;

  const blockTopLeftX = clientX - grabOffsetX - gridLeft;
  const blockTopLeftY = clientY - grabOffsetY - gridTop;

  const rawCol = Math.round(blockTopLeftX / colStride);
  const rawRow = Math.round(blockTopLeftY / rowStride);

  return {
    col: Math.min(Math.max(0, rawCol), Math.max(0, gridCols - spanCols)),
    row: Math.max(0, rawRow),
  };
}
