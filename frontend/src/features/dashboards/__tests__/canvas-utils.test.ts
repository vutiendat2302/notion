import { describe, expect, it } from "vitest";

import {
  computeDraggedGridCell,
  computeResizedGridBounds,
  extractMarkdownHeadings,
  materializeSpatialLayout,
  resolveGridSpanCols,
} from "@/features/dashboards/canvas-utils";
import {
  extractSlotsFromSpec,
  moveSlotInInternalGrid,
} from "@/features/dashboards/card-slots";
import { resolveMediaUrl } from "@/lib/api/client";
import type { DashboardWidget } from "@/types/domain";

function makeWidget(overrides: Partial<DashboardWidget>): DashboardWidget {
  return {
    id: "w-1",
    dashboard_id: "d-1",
    widget_kind: "METRIC_CARD",
    title: "Test",
    spec_json: {},
    position_x: 0,
    position_y: 0,
    width: 6,
    height: 2,
    created_at: "2026-11-22T00:00:00Z",
    updated_at: "2026-11-22T00:00:00Z",
    ...overrides,
  };
}

describe("canvas-utils & media URL resolution", () => {
  it("extracts H1/H2/H3 from TITLE widgets and markdown text prefixes", () => {
    const widgets: DashboardWidget[] = [
      makeWidget({
        id: "w1",
        title: "Main Title",
        spec_json: { preset_type: "TITLE", level: "h1", content: "LumiPlan Overview" },
      }),
      makeWidget({
        id: "w2",
        title: "Paragraph",
        spec_json: {
          preset_type: "TEXT",
          content: "## Weekly Goals\nSome body\n### Daily Action",
        },
      }),
    ];

    const headings = extractMarkdownHeadings(widgets);
    expect(headings).toEqual([
      { id: "w1-title", blockId: "w1", level: 1, text: "LumiPlan Overview" },
      { id: "w2-line-0", blockId: "w2", level: 2, text: "Weekly Goals" },
      { id: "w2-line-2", blockId: "w2", level: 3, text: "Daily Action" },
    ]);
  });

  it("computes grid resize bounds cleanly for 3x3 and 4x4 grids", () => {
    expect(resolveGridSpanCols(6, undefined, 4)).toBe(2);
    const resized = computeResizedGridBounds({
      startSpanCols: 1,
      startRows: 2,
      deltaX: 300,
      deltaY: 130,
      gridCols: 3,
      containerWidth: 900,
      rowUnitPx: 64,
    });
    expect(resized.nextSpanCols).toBe(2);
    expect(resized.nextWidth12).toBe(8);
    expect(resized.nextRows).toBe(4);
  });

  it("keeps static sounds and resolves /api/v1/ stream URLs cleanly", () => {
    expect(resolveMediaUrl("/sounds/default-countdown.wav")).toBe(
      "/sounds/default-countdown.wav"
    );
    expect(resolveMediaUrl("https://cdn.example.com/a.mp3")).toBe(
      "https://cdn.example.com/a.mp3"
    );
    expect(resolveMediaUrl("/api/v1/storage/files/123/stream")).toMatch(
      /\/api\/v1\/storage\/files\/123\/stream$/
    );
  });

  it("materializes 2D spatial layout and preserves intentional empty rows", () => {
    const w1 = makeWidget({
      id: "a",
      width: 6,
      height: 2,
      position_x: 1,
      position_y: 2,
      spec_json: { grid_placed: true, grid_col_span: 2 },
    });
    const w2 = makeWidget({
      id: "b",
      width: 6,
      height: 2,
      position_x: 0,
      position_y: 0,
      spec_json: { grid_placed: true, grid_col_span: 1 },
    });
    const layout = materializeSpatialLayout([w2, w1], 3);
    expect(layout.hasSpatial).toBe(true);
    expect(layout.rects.get("b")).toEqual({ col: 0, row: 0, spanCols: 1, rowSpan: 2 });
    expect(layout.rects.get("a")).toEqual({ col: 1, row: 2, spanCols: 2, rowSpan: 2 });
    expect(layout.totalRows).toBe(4);
  });

  it("extracts and moves internal card slots across 2D card grid columns", () => {
    const slots = extractSlotsFromSpec(
      {
        preset_type: "COMPOSITE_CARD",
        card_slots: [
          {
            id: "s1",
            kind: "HEADING",
            label: "H",
            value: "Hi",
            col: 0,
            row: 0,
            col_span: 2,
            row_span: 1,
            align: "left",
            font_size: "lg",
            tone: "default",
          },
        ],
      },
      "Fallback"
    );
    expect(slots).toHaveLength(1);
    const moved = moveSlotInInternalGrid(slots, "s1", 2, 2, 3);
    expect(moved[0].col).toBe(1); // clamped cleanly for col_span=2 in 3-col card
    expect(moved[0].row).toBe(2);
  });

  it("computes dragged grid cell accurately from top-left grab offset (no horizontal drift)", () => {
    // 6-col block (half of 12-col 1200px grid = ~600px wide), grabbed at its horizontal center (300px from block left)
    // User drops with pointer at x=600 (center of col 6) -> top-left is x=300 (col 3)
    const cell = computeDraggedGridCell({
      clientX: 600,
      clientY: 200,
      grabOffsetX: 300,
      grabOffsetY: 10,
      gridLeft: 0,
      gridTop: 100,
      gridWidth: 1200,
      gridCols: 12,
      spanCols: 6,
      rowUnitPx: 64,
      gapPx: 14,
    });
    expect(cell.col).toBe(3);
    expect(cell.row).toBe(1);
  });
});
