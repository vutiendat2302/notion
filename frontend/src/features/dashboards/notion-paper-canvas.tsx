"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Flame,
  FolderKanban,
  Grid3x3,
  GripVertical,
  Heading1,
  LayoutDashboard,
  Link2,
  ListChecks,
  Lock,
  MessageSquareQuote,
  Minus,
  Plus,
  Quote,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  Type,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchAnalyticsOverview, fetchStreak } from "@/features/analytics/api";
import { DynamicChartCard, type ChartFilterParams } from "@/features/analytics/chart-renderer";
import {
  addDashboardWidget,
  deleteDashboardWidget,
  fetchDashboard,
  listActiveBlockTemplates,
  listDashboards,
  patchDashboard,
  patchDashboardWidget,
} from "@/features/dashboards/api";
import {
  computeDraggedGridCell,
  computeResizedGridBounds,
  extractMarkdownHeadings,
  materializeSpatialLayout,
  resolveGridSpanCols,
} from "@/features/dashboards/canvas-utils";
import { CardLayoutStudio } from "@/features/dashboards/card-layout-studio";
import { CardSlotRenderer } from "@/features/dashboards/card-slot-renderer";
import { extractSlotsFromSpec, type CardSlot } from "@/features/dashboards/card-slots";
import { NotionTaskDatabase } from "@/features/dashboards/notion-task-database";
import { OutlineRail } from "@/features/dashboards/outline-rail";
import { PlanDatabaseBlock } from "@/features/dashboards/plan-database-block";
import { ProjectDatabaseBlock } from "@/features/dashboards/project-database-block";
import { createGoal, listGoals, toggleMilestone } from "@/features/goals/api";
import { createHabit, listHabits, logHabit } from "@/features/habits/api";
import { dateInTimeZone } from "@/features/planning/period";
import { fetchOccurrences, fetchProjects } from "@/features/tasks/api";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type {
  BlockTemplate,
  DashboardWidget,
  PeriodType,
  TemplateCategory,
} from "@/types/domain";

type BlockAlign = "left" | "center" | "right";
type HeadingLevel = "h1" | "h2" | "h3";
type BlockSurface = "paper" | "card" | "blue" | "lavender" | "sage" | "peach" | "rose" | "butter";
type BlockBorder = "none" | "hairline" | "solid" | "dashed" | "dotted" | "double" | "shadow";
type BlockRadius = "none" | "md" | "2xl";
type BlockPadding = "none" | "sm" | "md" | "lg";
type ImportMode = "copy" | "sync";
type GridColsOption = 3 | 4 | 6 | 12;

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface CustomTableColumn {
  id: string;
  label: string;
  type: "text" | "number";
}

interface CustomTableRow {
  id: string;
  cells: Record<string, string>;
}

const SURFACE_CLASSES: Record<BlockSurface, string> = {
  paper: "bg-transparent",
  card: "bg-card/85",
  blue: "bg-[#5D83BB]/12",
  lavender: "bg-[#A99ADB]/15",
  sage: "bg-[#8CB9A5]/15",
  peach: "bg-[#F0B28D]/16",
  rose: "bg-[#E6A0B0]/16",
  butter: "bg-[#E6C879]/18",
};

const RADIUS_CLASSES: Record<BlockRadius, string> = {
  none: "rounded-none",
  md: "rounded-lg",
  "2xl": "rounded-2xl",
};

const PADDING_CLASSES: Record<BlockPadding, string> = {
  none: "p-0",
  sm: "p-2.5",
  md: "p-4",
  lg: "p-6",
};

const TEMPLATE_ICONS: Record<string, typeof Sparkles> = {
  Heading1,
  Type,
  Sparkles,
  Quote,
  ListChecks,
  MessageSquareQuote,
  Code2,
  Minus,
  Table2,
  BarChart3,
  Check,
  Flame,
  LayoutDashboard,
  CalendarRange,
  FolderKanban,
};

function renderBlockBorderProps(
  border: BlockBorder,
  borderWidth: number,
  borderColor: string
): { className: string; style?: React.CSSProperties } {
  if (border === "none") return { className: "" };
  if (border === "hairline") return { className: "border border-border/80" };
  if (border === "shadow") return { className: "border border-border/50 shadow-sm" };
  return {
    className: "",
    style: {
      borderStyle: border,
      borderWidth: `${Math.max(1, Math.min(4, borderWidth))}px`,
      borderColor: borderColor || "#5D83BB",
    },
  };
}

export function NotionPaperCanvas({ dashboardId = "default" }: { dashboardId?: string }) {
  const { locale } = useI18n();
  const client = useQueryClient();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const isAdmin = meQuery.data?.role === "ADMIN";

  const dashQuery = useQuery({
    queryKey: ["dashboard-page", dashboardId],
    queryFn: () => fetchDashboard(dashboardId),
  });
  const templatesQuery = useQuery({
    queryKey: ["block-templates"],
    queryFn: listActiveBlockTemplates,
  });
  const allDashboardsQuery = useQuery({
    queryKey: ["dashboards-list"],
    queryFn: listDashboards,
  });
  const streakQuery = useQuery({ queryKey: ["streak"], queryFn: fetchStreak });
  const overviewQuery = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: fetchAnalyticsOverview,
  });
  const todayOccsQuery = useQuery({
    queryKey: ["occurrences", "today"],
    queryFn: () => fetchOccurrences("today"),
  });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const habitsQuery = useQuery({ queryKey: ["habits"], queryFn: () => listHabits() });
  const goalsQuery = useQuery({ queryKey: ["goals"], queryFn: listGoals });

  const todayIso = dateInTimeZone(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh"
  );

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [editingWidget, setEditingWidget] = useState<{
    widget: DashboardWidget;
    localId: string;
    targetDashId: string;
  } | null>(null);
  const [sendingWidget, setSendingWidget] = useState<DashboardWidget | null>(null);

  // Active mouse drag resize & 1:1 Pointer Grid Drag-Move state (default: free paper, no grid guides)
  const [resizeMode, setResizeMode] = useState(false);
  const [dragBlockState, setDragBlockState] = useState<{
    widgetId: string;
    dx: number;
    dy: number;
    targetCol: number;
    targetRow: number;
    spanCols: number;
    rowSpan: number;
  } | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    widgetId: string;
    cols: number;
    rows: number;
  } | null>(null);

  // Import from another page state inside + Add Block modal
  const [importSourceDashId, setImportSourceDashId] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("copy");
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);

  // Send block to another page modal state
  const [sendDestDashId, setSendDestDashId] = useState("");
  const [sendMode, setSendMode] = useState<ImportMode>("copy");

  // Full Block Customizer modal state
  const [editTitle, setEditTitle] = useState("");
  const [editColSpan, setEditColSpan] = useState(6);
  const [editHeightRows, setEditHeightRows] = useState(2);
  const [editCustomHeight, setEditCustomHeight] = useState(false);
  const [editAlign, setEditAlign] = useState<BlockAlign>("left");
  const [editSurface, setEditSurface] = useState<BlockSurface>("paper");
  const [editBorder, setEditBorder] = useState<BlockBorder>("none");
  const [editBorderWidth, setEditBorderWidth] = useState(1);
  const [editBorderColor, setEditBorderColor] = useState("#5D83BB");
  const [editRadius, setEditRadius] = useState<BlockRadius>("md");
  const [editPadding, setEditPadding] = useState<BlockPadding>("md");
  const [editProjectId, setEditProjectId] = useState("");
  const [editGroupBy, setEditGroupBy] = useState("project");
  const [editInternalCols, setEditInternalCols] = useState(2);
  const [editCardSlots, setEditCardSlots] = useState<CardSlot[]>([]);
  const [editHasCompositeSlots, setEditHasCompositeSlots] = useState(false);

  // Local drafts & toggles
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [openToggles, setOpenToggles] = useState<Record<string, boolean>>({});
  const [newCheckInputs, setNewCheckInputs] = useState<Record<string, string>>({});
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newGoalTitle, setNewGoalTitle] = useState("");

  // Close any open modal on Escape
  useEffect(() => {
    if (!showAddModal && !editingWidget && !sendingWidget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowAddModal(false);
        setEditingWidget(null);
        setSendingWidget(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingWidget, sendingWidget, showAddModal]);

  const dash = dashQuery.data;
  const styleCfg = (dash?.style_config ?? {}) as {
    grid_cols?: GridColsOption;
  };
  const gridCols: GridColsOption =
    styleCfg.grid_cols === 3 || styleCfg.grid_cols === 4 || styleCfg.grid_cols === 6
      ? styleCfg.grid_cols
      : 12;
  const showGridGuides = resizeMode;

  const otherDashboards = useMemo(
    () => (allDashboardsQuery.data ?? []).filter((d) => d.id !== dashboardId && d.id !== dash?.id),
    [allDashboardsQuery.data, dash?.id, dashboardId]
  );

  const importSourceDashQuery = useQuery({
    queryKey: ["dashboard-page", importSourceDashId],
    queryFn: () => fetchDashboard(importSourceDashId),
    enabled: showAddModal && Boolean(importSourceDashId),
  });

  const widgets = useMemo(() => {
    const raw = dash?.widgets ?? [];
    return [...raw].sort(
      (a, b) => a.position_y - b.position_y || a.created_at.localeCompare(b.created_at)
    );
  }, [dash?.widgets]);

  // Fetch all referenced source dashboards for SYNCED_REF widgets
  const syncSourceDashIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of widgets) {
      if (
        w.spec_json.preset_type === "SYNCED_REF" &&
        typeof w.spec_json.source_dashboard_id === "string"
      ) {
        ids.add(w.spec_json.source_dashboard_id);
      }
    }
    return Array.from(ids);
  }, [widgets]);

  const syncSourceQueries = useQueries({
    queries: syncSourceDashIds.map((srcId) => ({
      queryKey: ["dashboard-page", srcId],
      queryFn: () => fetchDashboard(srcId),
      retry: false,
    })),
  });

  const sourceDashMap = useMemo(() => {
    const map = new Map<string, typeof dash>();
    syncSourceDashIds.forEach((srcId, idx) => {
      const data = syncSourceQueries[idx]?.data;
      if (data) map.set(srcId, data);
    });
    return map;
  }, [syncSourceDashIds, syncSourceQueries]);

  // Resolve final widgets (replacing SYNCED_REF references with source widget for Outline & rendering)
  const resolvedHeadings = useMemo(() => {
    const mapped: DashboardWidget[] = widgets.map((localWidget) => {
      if (localWidget.spec_json.preset_type === "SYNCED_REF") {
        const srcDashId = String(localWidget.spec_json.source_dashboard_id ?? "");
        const srcWidgetId = String(localWidget.spec_json.source_widget_id ?? "");
        const sourceWidget = sourceDashMap
          .get(srcDashId)
          ?.widgets.find((it) => it.id === srcWidgetId);
        if (sourceWidget) {
          return { ...sourceWidget, id: localWidget.id };
        }
      }
      return localWidget;
    });
    return extractMarkdownHeadings(mapped);
  }, [sourceDashMap, widgets]);

  const spatialLayout = useMemo(
    () => materializeSpatialLayout(widgets, gridCols),
    [gridCols, widgets]
  );

  const nextPosY = useMemo(() => {
    if (spatialLayout.hasSpatial) return spatialLayout.totalRows;
    return widgets.length ? Math.max(...widgets.map((w) => w.position_y)) + 1 : 0;
  }, [spatialLayout.hasSpatial, spatialLayout.totalRows, widgets]);

  const patchDashStyleMut = useMutation({
    mutationFn: (nextStyle: Record<string, unknown>) =>
      patchDashboard(dashboardId, { style_config: { ...styleCfg, ...nextStyle } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
    },
  });

  const addWidgetMut = useMutation({
    mutationFn: (payload: Parameters<typeof addDashboardWidget>[0]) =>
      addDashboardWidget(payload, dashboardId),
    onSuccess: async () => {
      setShowAddModal(false);
      await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
      toast.success(locale === "en" ? "Block added" : "Đã thêm block");
    },
  });

  const patchWidgetMut = useMutation({
    mutationFn: ({
      id,
      targetDashId = dashboardId,
      title,
      width,
      height,
      position_y,
      spec,
    }: {
      id: string;
      targetDashId?: string;
      title?: string;
      width?: number;
      height?: number;
      position_y?: number;
      spec?: Record<string, unknown>;
    }) =>
      patchDashboardWidget(
        id,
        {
          ...(title !== undefined ? { title } : {}),
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
          ...(position_y !== undefined ? { position_y } : {}),
          ...(spec !== undefined ? { spec_json: spec } : {}),
        },
        targetDashId
      ),
    onSuccess: async (_data, vars) => {
      setEditingWidget(null);
      await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
      if (vars.targetDashId && vars.targetDashId !== dashboardId) {
        await client.invalidateQueries({ queryKey: ["dashboard-page", vars.targetDashId] });
      }
    },
  });

  const deleteWidgetMut = useMutation({
    mutationFn: (id: string) => deleteDashboardWidget(id, dashboardId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
    },
  });

  const importFromOtherMut = useMutation({
    mutationFn: async () => {
      const srcDash = importSourceDashQuery.data;
      if (!srcDash || selectedImportIds.length === 0) return;
      let y = nextPosY;
      for (const widId of selectedImportIds) {
        const srcW = srcDash.widgets.find((item) => item.id === widId);
        if (!srcW) continue;
        if (importMode === "sync") {
          const resolvedDashId =
            srcW.spec_json.preset_type === "SYNCED_REF" &&
            typeof srcW.spec_json.source_dashboard_id === "string"
              ? srcW.spec_json.source_dashboard_id
              : srcDash.id;
          const resolvedWidgetId =
            srcW.spec_json.preset_type === "SYNCED_REF" &&
            typeof srcW.spec_json.source_widget_id === "string"
              ? srcW.spec_json.source_widget_id
              : srcW.id;
          await addDashboardWidget(
            {
              widget_kind: "METRIC_CARD",
              title: srcW.title,
              spec_json: {
                preset_type: "SYNCED_REF",
                source_dashboard_id: resolvedDashId,
                source_widget_id: resolvedWidgetId,
              },
              position_y: y++,
              width: srcW.width,
              height: srcW.height,
            },
            dashboardId
          );
        } else {
          await addDashboardWidget(
            {
              widget_kind: srcW.widget_kind,
              title: srcW.title,
              spec_json: srcW.spec_json,
              position_y: y++,
              width: srcW.width,
              height: srcW.height,
            },
            dashboardId
          );
        }
      }
    },
    onSuccess: async () => {
      setSelectedImportIds([]);
      setShowAddModal(false);
      await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
      toast.success(
        importMode === "sync"
          ? locale === "en"
            ? "Synced block embedded"
            : "Đã nhúng block đồng bộ"
          : locale === "en"
            ? "Copied blocks to page"
            : "Đã copy block vào trang"
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Import failed"),
  });

  const sendToOtherMut = useMutation({
    mutationFn: async () => {
      if (!sendingWidget || !sendDestDashId) return;
      const resolvedSrcDashId =
        sendingWidget.spec_json.preset_type === "SYNCED_REF" &&
        typeof sendingWidget.spec_json.source_dashboard_id === "string"
          ? sendingWidget.spec_json.source_dashboard_id
          : dash?.id || dashboardId;
      const resolvedSrcWidgetId =
        sendingWidget.spec_json.preset_type === "SYNCED_REF" &&
        typeof sendingWidget.spec_json.source_widget_id === "string"
          ? sendingWidget.spec_json.source_widget_id
          : sendingWidget.id;

      if (sendMode === "sync") {
        await addDashboardWidget(
          {
            widget_kind: "METRIC_CARD",
            title: sendingWidget.title,
            spec_json: {
              preset_type: "SYNCED_REF",
              source_dashboard_id: resolvedSrcDashId,
              source_widget_id: resolvedSrcWidgetId,
            },
            width: sendingWidget.width,
            height: sendingWidget.height,
          },
          sendDestDashId
        );
      } else {
        await addDashboardWidget(
          {
            widget_kind: sendingWidget.widget_kind,
            title: sendingWidget.title,
            spec_json: sendingWidget.spec_json,
            width: sendingWidget.width,
            height: sendingWidget.height,
          },
          sendDestDashId
        );
      }
    },
    onSuccess: async () => {
      const destId = sendDestDashId;
      setSendingWidget(null);
      if (destId) {
        await client.invalidateQueries({ queryKey: ["dashboard-page", destId] });
      }
      toast.success(
        sendMode === "sync"
          ? locale === "en"
            ? "Synced block sent"
            : "Đã gửi block đồng bộ"
          : locale === "en"
            ? "Copied block to destination page"
            : "Đã copy block sang trang đích"
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to send block"),
  });

  const logHabitMut = useMutation({
    mutationFn: ({ habitId, status }: { habitId: string; status: "COMPLETED" | "SKIPPED" }) =>
      logHabit(habitId, { log_date: todayIso, status }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["habits"] }),
        client.invalidateQueries({ queryKey: ["streak"] }),
        client.invalidateQueries({ queryKey: ["chart"] }),
      ]);
    },
  });

  const createHabitMut = useMutation({
    mutationFn: () => createHabit({ title: newHabitTitle.trim(), starts_on: todayIso }),
    onSuccess: async () => {
      setNewHabitTitle("");
      await client.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  const createGoalMut = useMutation({
    mutationFn: () =>
      createGoal({
        title: newGoalTitle.trim(),
        metric_unit: "%",
        target_value: 100,
        start_date: todayIso,
        end_date: todayIso,
      }),
    onSuccess: async () => {
      setNewGoalTitle("");
      await client.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const toggleMsMut = useMutation({
    mutationFn: ({
      goalId,
      msId,
      status,
    }: {
      goalId: string;
      msId: string;
      status: "PENDING" | "COMPLETED";
    }) => toggleMilestone(goalId, msId, status),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  async function persistSpatialMove(movedWidgetId: string, targetCol: number, targetRow: number) {
    const updates: Array<Promise<unknown>> = [];
    for (const item of widgets) {
      const rect = spatialLayout.rects.get(item.id);
      const spanCols = rect?.spanCols ?? resolveGridSpanCols(item.width, item.spec_json.grid_col_span, gridCols);
      if (item.id === movedWidgetId) {
        const clampedCol = Math.min(Math.max(0, targetCol), Math.max(0, gridCols - spanCols));
        const clampedRow = Math.max(0, targetRow);
        updates.push(
          patchDashboardWidget(
            item.id,
            {
              position_x: clampedCol,
              position_y: clampedRow,
              spec_json: {
                ...item.spec_json,
                grid_placed: true,
                grid_col_span: spanCols,
              },
            },
            dashboardId
          )
        );
      } else if (item.spec_json.grid_placed !== true && rect) {
        // Materialize existing un-placed widgets so they hold their position and allow empty rows
        updates.push(
          patchDashboardWidget(
            item.id,
            {
              position_x: rect.col,
              position_y: rect.row,
              spec_json: {
                ...item.spec_json,
                grid_placed: true,
                grid_col_span: rect.spanCols,
              },
            },
            dashboardId
          )
        );
      }
    }
    await Promise.all(updates);
    await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
  }

  async function nudgeBlock(localWidget: DashboardWidget, dx: number, dy: number) {
    const rect = spatialLayout.rects.get(localWidget.id);
    const curCol = rect?.col ?? localWidget.position_x;
    const curRow = rect?.row ?? localWidget.position_y;
    await persistSpatialMove(localWidget.id, curCol + dx, curRow + dy);
  }

  async function moveBlock(index: number, dir: -1 | 1) {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= widgets.length) return;
    if (spatialLayout.hasSpatial) {
      const current = widgets[index];
      const neighbor = widgets[targetIdx];
      const curRect = spatialLayout.rects.get(current.id);
      const neiRect = spatialLayout.rects.get(neighbor.id);
      if (curRect && neiRect) {
        await Promise.all([
          patchDashboardWidget(
            current.id,
            {
              position_x: neiRect.col,
              position_y: neiRect.row,
              spec_json: { ...current.spec_json, grid_placed: true },
            },
            dashboardId
          ),
          patchDashboardWidget(
            neighbor.id,
            {
              position_x: curRect.col,
              position_y: curRect.row,
              spec_json: { ...neighbor.spec_json, grid_placed: true },
            },
            dashboardId
          ),
        ]);
        await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
        return;
      }
    }
    // Sequential order swap with clean normalized indices (no duplicate position_y collisions)
    const reordered = [...widgets];
    const [picked] = reordered.splice(index, 1);
    if (!picked) return;
    reordered.splice(targetIdx, 0, picked);
    await Promise.all(
      reordered.map((item, seqIdx) =>
        item.position_y !== seqIdx
          ? patchDashboardWidget(item.id, { position_y: seqIdx }, dashboardId)
          : Promise.resolve(null)
      )
    );
    await client.invalidateQueries({ queryKey: ["dashboard-page", dashboardId] });
  }

  function startMouseResize(
    e: React.PointerEvent<HTMLButtonElement>,
    localWidget: DashboardWidget,
    axis: "x" | "y" | "both"
  ) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startSpanCols = resolveGridSpanCols(
      localWidget.width,
      localWidget.spec_json.grid_col_span,
      gridCols
    );
    const startRows = Math.max(1, Math.min(12, localWidget.height || 2));
    const gridEl = e.currentTarget.closest("[data-notion-grid]") as HTMLElement | null;
    const containerWidth = gridEl?.clientWidth || 960;

    let latest = {
      nextSpanCols: startSpanCols,
      nextWidth12: localWidget.width,
      nextRows: startRows,
    };
    setResizePreview({ widgetId: localWidget.id, cols: startSpanCols, rows: startRows });

    const onMove = (ev: PointerEvent) => {
      const dx = axis === "y" ? 0 : ev.clientX - startX;
      const dy = axis === "x" ? 0 : ev.clientY - startY;
      latest = computeResizedGridBounds({
        startSpanCols,
        startRows,
        deltaX: dx,
        deltaY: dy,
        gridCols,
        containerWidth,
        rowUnitPx: 64,
      });
      setResizePreview({
        widgetId: localWidget.id,
        cols: latest.nextSpanCols,
        rows: latest.nextRows,
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizePreview(null);

      patchWidgetMut.mutate({
        id: localWidget.id,
        targetDashId: dashboardId,
        width: latest.nextWidth12,
        height: latest.nextRows,
        spec: {
          ...localWidget.spec_json,
          grid_col_span: latest.nextSpanCols,
          custom_height: true,
        },
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startBlockPointerDrag(
    e: React.PointerEvent<HTMLElement>,
    localWidget: DashboardWidget,
    startCol: number,
    startRow: number,
    spanCols: number,
    rowSpan: number
  ) {
    if (!showGridGuides) return;
    if ((e.target as HTMLElement).closest("button,input,select,textarea,a")) return;
    e.preventDefault();
    e.stopPropagation();

    const blockEl = e.currentTarget.closest("[data-outline-block-id]") as HTMLElement | null;
    const gridEl = (blockEl?.closest("[data-notion-grid]") ??
      e.currentTarget.closest("[data-notion-grid]")) as HTMLElement | null;
    if (!gridEl || !blockEl) return;

    const gridRect = gridEl.getBoundingClientRect();
    const gridStyle = window.getComputedStyle(gridEl);
    const padLeft = parseFloat(gridStyle.paddingLeft) || 0;
    const padRight = parseFloat(gridStyle.paddingRight) || 0;
    const padTop = parseFloat(gridStyle.paddingTop) || 0;
    const contentLeft = gridRect.left + padLeft;
    const contentTop = gridRect.top + padTop;
    const contentWidth = Math.max(120, gridRect.width - padLeft - padRight);
    const blockRect = blockEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const grabOffsetX = startX - blockRect.left;
    const grabOffsetY = startY - blockRect.top;

    let latest = { col: startCol, row: startRow };
    setDragBlockState({
      widgetId: localWidget.id,
      dx: 0,
      dy: 0,
      targetCol: startCol,
      targetRow: startRow,
      spanCols,
      rowSpan,
    });

    const onMove = (ev: PointerEvent) => {
      const next = computeDraggedGridCell({
        clientX: ev.clientX,
        clientY: ev.clientY,
        grabOffsetX,
        grabOffsetY,
        gridLeft: contentLeft,
        gridTop: contentTop,
        gridWidth: contentWidth,
        gridCols,
        spanCols,
        rowUnitPx: 64,
        gapPx: 14,
      });
      latest = next;
      setDragBlockState({
        widgetId: localWidget.id,
        dx: ev.clientX - startX,
        dy: ev.clientY - startY,
        targetCol: next.col,
        targetRow: next.row,
        spanCols,
        rowSpan,
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragBlockState(null);
      if (latest.col !== startCol || latest.row !== startRow) {
        void persistSpatialMove(localWidget.id, latest.col, latest.row);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function addFromTemplate(tpl: BlockTemplate) {
    const colSpan = resolveGridSpanCols(tpl.default_width, undefined, gridCols);
    addWidgetMut.mutate({
      widget_kind: tpl.widget_kind,
      title: tpl.default_title,
      spec_json: {
        ...tpl.default_spec_json,
        template_slug: tpl.slug,
        is_user_customizable: tpl.is_user_customizable,
        grid_col_span: colSpan,
        ...(spatialLayout.hasSpatial ? { grid_placed: true } : {}),
      },
      position_x: 0,
      position_y: nextPosY,
      width: tpl.default_width,
      height: tpl.default_height,
    });
  }

  function openAddBlockModal() {
    setSelectedImportIds([]);
    setTemplateSearch("");
    if (!importSourceDashId && otherDashboards.length > 0) {
      setImportSourceDashId(otherDashboards[0].id);
    }
    setShowAddModal(true);
  }

  const categorizedTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    const list = (templatesQuery.data ?? []).filter((tpl) => {
      if (!q) return true;
      return (
        tpl.name_vi.toLowerCase().includes(q) ||
        tpl.name_en.toLowerCase().includes(q) ||
        tpl.description_vi.toLowerCase().includes(q) ||
        tpl.description_en.toLowerCase().includes(q)
      );
    });
    const groups: Record<TemplateCategory, BlockTemplate[]> = {
      TEXT_FORMAT: [],
      FORM_TABLE: [],
      PRODUCTIVITY: [],
      CHART: [],
    };
    for (const item of list) {
      groups[item.category]?.push(item);
    }
    return groups;
  }, [templateSearch, templatesQuery.data]);

  if (dashQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-secondary/40" />;
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-7.5rem)] w-full flex-col">
      <h1 className="sr-only">{dash?.title || "LumiPlan Page"}</h1>

      {/* Floating Right-Edge Markdown Headings (#, ##, ###) Outline Rail */}
      <OutlineRail headings={resolvedHeadings} />

      {/* Subtle Top-Right Toggle: Default is Free Layout; turning on Khung ô enables resize handles & grid selector */}
      {widgets.length > 0 && (
        <div
          className={cn(
            "mb-3 flex flex-wrap items-center justify-end gap-1.5 transition-opacity",
            showGridGuides
              ? "opacity-100"
              : "opacity-35 hover:opacity-100 focus-within:opacity-100"
          )}
        >
          {showGridGuides && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card/80 p-0.5 text-[11px]">
              <Grid3x3 className="ml-1.5 h-3 w-3 text-muted-foreground" />
              {([
                [12, locale === "en" ? "Free" : "Tự do"],
                [3, "3×3"],
                [4, "4×4"],
                [6, "6×N"],
              ] as const).map(([colsVal, label]) => (
                <button
                  key={colsVal}
                  type="button"
                  onClick={() => patchDashStyleMut.mutate({ grid_cols: colsVal })}
                  className={cn(
                    "rounded-md px-2 py-0.5 font-medium transition-colors",
                    gridCols === colsVal
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setResizeMode((prev) => !prev)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
              showGridGuides
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border/70 bg-card/80 text-muted-foreground hover:text-foreground"
            )}
          >
            <Grid3x3 className="h-3 w-3" />
            <span>
              {showGridGuides
                ? locale === "en"
                  ? "Done resizing"
                  : "Xong khung ô"
                : locale === "en"
                  ? "Grid & Resize"
                  : "Khung ô"}
            </span>
          </button>
        </div>
      )}

      {/* Blocks Grid (Supports true 2D spatial cell placement, 1:1 Pointer Drag-Move, and empty rows) */}
      {widgets.length > 0 && (() => {
        const useSpatialGrid = showGridGuides || spatialLayout.hasSpatial;
        const gridRowsCount = Math.max(
          showGridGuides ? 6 : 1,
          spatialLayout.totalRows + (showGridGuides ? 2 : 0),
          dragBlockState ? dragBlockState.targetRow + dragBlockState.rowSpan + 1 : 1
        );

        return (
        <div
          ref={gridRef}
          data-notion-grid="true"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            ...(useSpatialGrid
              ? { gridTemplateRows: `repeat(${gridRowsCount}, minmax(64px, auto))` }
              : {}),
          }}
          className={cn(
            "relative grid gap-3.5 transition-all",
            showGridGuides &&
              "rounded-2xl border border-dashed border-border/70 bg-secondary/10 p-3 select-none"
          )}
        >
          {/* Interactive Grid Background Cells rendered when Khung ô is enabled */}
          {showGridGuides &&
            Array.from({ length: gridRowsCount }, (_, rIdx) =>
              Array.from({ length: gridCols }, (_, cIdx) => {
                const isDropFootprint =
                  Boolean(dragBlockState) &&
                  dragBlockState !== null &&
                  cIdx >= dragBlockState.targetCol &&
                  cIdx < dragBlockState.targetCol + dragBlockState.spanCols &&
                  rIdx >= dragBlockState.targetRow &&
                  rIdx < dragBlockState.targetRow + dragBlockState.rowSpan;

                return (
                  <div
                    key={`cell-${rIdx}-${cIdx}`}
                    style={{
                      gridColumn: `${cIdx + 1} / span 1`,
                      gridRow: `${rIdx + 1} / span 1`,
                    }}
                    className={cn(
                      "z-0 min-h-14 rounded-lg border border-dashed transition-colors",
                      isDropFootprint
                        ? "border-primary bg-primary/20"
                        : "border-border/35 bg-background/20"
                    )}
                  />
                );
              })
            )}

          {widgets.map((localWidget, idx) => {
            const isSyncedRef = localWidget.spec_json.preset_type === "SYNCED_REF";
            const srcDashId = isSyncedRef
              ? String(localWidget.spec_json.source_dashboard_id ?? "")
              : "";
            const srcWidgetId = isSyncedRef
              ? String(localWidget.spec_json.source_widget_id ?? "")
              : "";
            const srcDash = isSyncedRef ? sourceDashMap.get(srcDashId) : undefined;
            const syncedSource = srcDash?.widgets.find((item) => item.id === srcWidgetId) ?? null;

            const w = isSyncedRef && syncedSource ? syncedSource : localWidget;
            const targetDashId =
              isSyncedRef && syncedSource ? syncedSource.dashboard_id : dashboardId;
            const syncedBroken = isSyncedRef && Boolean(srcDash) && !syncedSource;

            const chartKey =
              typeof w.spec_json.chart_key === "string" ? w.spec_json.chart_key : null;
            const kind =
              typeof w.spec_json.preset_type === "string" ? w.spec_json.preset_type : null;
            const align = (w.spec_json.align as BlockAlign | undefined) ?? "left";
            const headingLevel = (w.spec_json.level as HeadingLevel | undefined) ?? "h1";
            const surface = (w.spec_json.surface as BlockSurface | undefined) ?? "paper";
            const border = (w.spec_json.border as BlockBorder | undefined) ?? "none";
            const borderWidth = Number(w.spec_json.border_width ?? 1);
            const borderColor = String(w.spec_json.border_color ?? "#5D83BB");
            const radius = (w.spec_json.radius as BlockRadius | undefined) ?? "md";
            const padding = (w.spec_json.padding as BlockPadding | undefined) ?? "md";
            const filters = (w.spec_json.filters ?? {}) as ChartFilterParams;
            const canUserCustomize =
              isAdmin || w.spec_json.is_user_customizable !== false;

            const layoutRect = spatialLayout.rects.get(localWidget.id);
            const activeDrag =
              dragBlockState && dragBlockState.widgetId === localWidget.id
                ? dragBlockState
                : null;
            const activeResize =
              resizePreview && resizePreview.widgetId === localWidget.id ? resizePreview : null;
            const spanCols = activeResize
              ? activeResize.cols
              : layoutRect?.spanCols ??
                resolveGridSpanCols(
                  localWidget.width,
                  localWidget.spec_json.grid_col_span,
                  gridCols
                );
            const useFixedRows = Boolean(localWidget.spec_json.custom_height || activeResize);
            const rowsCount = activeResize
              ? activeResize.rows
              : Math.max(1, Math.min(12, localWidget.height || 2));

            const borderProps = renderBlockBorderProps(
              border,
              borderWidth,
              borderColor
            );

            const alignClass =
              align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

            const draftKey = w.id;
            const currentValue =
              textDrafts[draftKey] ??
              (typeof w.spec_json.content === "string" ? w.spec_json.content : w.title);

            const isRichTextBlock =
              kind === "TITLE" ||
              kind === "TEXT" ||
              kind === "CALLOUT" ||
              kind === "QUOTE" ||
              kind === "HERO_BANNER";

            const placementStyle: React.CSSProperties =
              useSpatialGrid && layoutRect
                ? {
                    gridColumn: `${layoutRect.col + 1} / span ${spanCols}`,
                    gridRow: `${layoutRect.row + 1} / span ${rowsCount}`,
                  }
                : {
                    gridColumn: `span ${spanCols} / span ${spanCols}`,
                  };

            return (
              <div
                key={localWidget.id}
                data-outline-block-id={localWidget.id}
                onPointerDown={(e) => {
                  if (!showGridGuides) return;
                  startBlockPointerDrag(
                    e,
                    localWidget,
                    layoutRect?.col ?? 0,
                    layoutRect?.row ?? 0,
                    spanCols,
                    rowsCount
                  );
                }}
                style={{
                  ...placementStyle,
                  ...(useFixedRows ? { minHeight: `${rowsCount * 64}px` } : {}),
                  ...borderProps.style,
                  ...(activeDrag
                    ? {
                        transform: `translate3d(${activeDrag.dx}px, ${activeDrag.dy}px, 0)`,
                      }
                    : {}),
                }}
                className={cn(
                  "group relative z-10 flex flex-col",
                  !activeDrag && "transition-all",
                  SURFACE_CLASSES[surface],
                  borderProps.className,
                  RADIUS_CLASSES[radius],
                  kind === "DIVIDER" ? "py-1" : PADDING_CLASSES[padding],
                  showGridGuides && border === "none" && "ring-1 ring-border/50",
                  showGridGuides && "cursor-grab active:cursor-grabbing",
                  activeDrag && "z-30 shadow-2xl ring-2 ring-primary",
                  isSyncedRef && "ring-1 ring-primary/35",
                  activeResize && "z-20 ring-2 ring-primary"
                )}
              >
                {/* Live Resize Dimensions Indicator */}
                {activeResize && (
                  <div className="pointer-events-none absolute left-2 top-2 z-30 rounded bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-foreground shadow">
                    {activeResize.cols} col × {activeResize.rows} row
                  </div>
                )}

                {/* Hover / Khung ô Customizer Toolbar */}
                <div
                  className={cn(
                    "mb-1 flex items-center justify-end gap-1 transition-opacity",
                    showGridGuides
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                  )}
                >
                  {showGridGuides && (
                    <span className="mr-auto inline-flex items-center gap-1 rounded bg-secondary/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <GripVertical className="h-3 w-3" />
                      <span>{locale === "en" ? "Drag" : "Kéo ô"}</span>
                    </span>
                  )}
                  {isSyncedRef && !showGridGuides && (
                    <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Link2 className="h-2.5 w-2.5" />
                      <span>Synced</span>
                    </span>
                  )}

                  {isRichTextBlock && !syncedBroken && (
                    <>
                      {kind === "TITLE" && (
                        <div className="mr-1 flex items-center rounded-md border border-border bg-card p-0.5 text-[10px]">
                          {(["h1", "h2", "h3"] as const).map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() =>
                                patchWidgetMut.mutate({
                                  id: w.id,
                                  targetDashId,
                                  spec: { ...w.spec_json, level: lvl },
                                })
                              }
                              className={cn(
                                "rounded px-1.5 py-0.5 font-semibold uppercase",
                                headingLevel === lvl
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mr-1 flex items-center rounded-md border border-border bg-card p-0.5">
                        {(
                          [
                            ["left", AlignLeft],
                            ["center", AlignCenter],
                            ["right", AlignRight],
                          ] as const
                        ).map(([al, Icon]) => (
                          <button
                            key={al}
                            type="button"
                            onClick={() =>
                              patchWidgetMut.mutate({
                                id: w.id,
                                targetDashId,
                                spec: { ...w.spec_json, align: al },
                              })
                            }
                            aria-label={`Align ${al}`}
                            className={cn(
                              "rounded p-1",
                              align === al
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Icon className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {showGridGuides ? (
                    <>
                      <button
                        type="button"
                        disabled={(layoutRect?.col ?? 0) === 0}
                        onClick={() => void nudgeBlock(localWidget, -1, 0)}
                        title={locale === "en" ? "Move left 1 col" : "Sang trái 1 ô"}
                        aria-label="Move left"
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={(layoutRect?.col ?? 0) + spanCols >= gridCols}
                        onClick={() => void nudgeBlock(localWidget, 1, 0)}
                        title={locale === "en" ? "Move right 1 col" : "Sang phải 1 ô"}
                        aria-label="Move right"
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={(layoutRect?.row ?? 0) === 0}
                        onClick={() => void nudgeBlock(localWidget, 0, -1)}
                        title={locale === "en" ? "Move up 1 row" : "Lên 1 hàng"}
                        aria-label="Move up 1 row"
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void nudgeBlock(localWidget, 0, 1)}
                        title={locale === "en" ? "Move down 1 row (leave empty row)" : "Xuống 1 hàng (để trống hàng trên)"}
                        aria-label="Move down 1 row"
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void moveBlock(idx, -1)}
                        aria-label="Move up"
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === widgets.length - 1}
                        onClick={() => void moveBlock(idx, 1)}
                        aria-label="Move down"
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}

                  {otherDashboards.length > 0 && !syncedBroken && (
                    <button
                      type="button"
                      onClick={() => {
                        setSendDestDashId(otherDashboards[0].id);
                        setSendMode("copy");
                        setSendingWidget(w);
                      }}
                      title={
                        locale === "en" ? "Send / Copy to page..." : "Gửi / Copy tới trang..."
                      }
                      aria-label="Send to page"
                      className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {!syncedBroken && (
                    <button
                      type="button"
                      disabled={!canUserCustomize}
                      onClick={() => {
                        setEditingWidget({
                          widget: w,
                          localId: localWidget.id,
                          targetDashId,
                        });
                        setEditTitle(w.title);
                        setEditColSpan(spanCols);
                        setEditHeightRows(rowsCount);
                        setEditCustomHeight(Boolean(localWidget.spec_json.custom_height));
                        setEditAlign(align);
                        setEditSurface(surface);
                        setEditBorder(border);
                        setEditBorderWidth(borderWidth);
                        setEditBorderColor(borderColor);
                        setEditRadius(radius);
                        setEditPadding(padding);
                        setEditProjectId(String(filters.project_id ?? ""));
                        setEditGroupBy(String(filters.group_by ?? "project"));
                        const isComposite =
                          kind === "COMPOSITE_CARD" ||
                          (Array.isArray(w.spec_json.card_slots) && w.spec_json.card_slots.length > 0);
                        setEditHasCompositeSlots(isComposite);
                        setEditInternalCols(Number(w.spec_json.internal_cols ?? 2));
                        setEditCardSlots(extractSlotsFromSpec(w.spec_json, w.title));
                      }}
                      title={
                        canUserCustomize
                          ? locale === "en"
                            ? "Customize block"
                            : "Tùy biến block & viền"
                          : locale === "en"
                            ? "Locked by Admin"
                            : "Mẫu được khóa bởi Admin"
                      }
                      className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
                      aria-label="Customize block"
                    >
                      {canUserCustomize ? (
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteWidgetMut.mutate(localWidget.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Block Content Renderers */}
                <div className="flex-1">
                  {syncedBroken ? (
                    <p className="text-xs text-muted-foreground">
                      {locale === "en"
                        ? "Source block was deleted."
                        : "Block nguồn đã bị xóa hoặc không còn tồn tại."}
                    </p>
                  ) : kind === "TITLE" ? (
                    <input
                      value={currentValue}
                      onChange={(e) =>
                        setTextDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                      }
                      onBlur={() => {
                        const clean = currentValue.trim() || "Untitled";
                        if (clean !== w.spec_json.content || clean !== w.title) {
                          patchWidgetMut.mutate({
                            id: w.id,
                            targetDashId,
                            title: clean.slice(0, 180),
                            spec: { ...w.spec_json, content: clean },
                          });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                      }}
                      placeholder={locale === "en" ? "Heading..." : "Nhập tiêu đề..."}
                      className={cn(
                        "w-full bg-transparent font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50",
                        alignClass,
                        headingLevel === "h1"
                          ? "text-3xl sm:text-4xl"
                          : headingLevel === "h2"
                            ? "text-2xl sm:text-3xl"
                            : "text-xl sm:text-2xl"
                      )}
                    />
                  ) : kind === "TEXT" ? (
                    <textarea
                      rows={Math.max(2, Math.min(8, currentValue.split("\n").length + 1))}
                      value={currentValue}
                      onChange={(e) =>
                        setTextDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                      }
                      onBlur={() => {
                        if (currentValue !== w.spec_json.content) {
                          patchWidgetMut.mutate({
                            id: w.id,
                            targetDashId,
                            spec: { ...w.spec_json, content: currentValue },
                          });
                        }
                      }}
                      placeholder={
                        locale === "en"
                          ? "Write paragraph (use # ## ### for headings)..."
                          : "Viết nội dung (dùng #, ##, ### để hiện trên thanh Outline)..."
                      }
                      className={cn(
                        "w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50",
                        alignClass
                      )}
                    />
                  ) : kind === "CALLOUT" ? (
                    <div className={cn("flex items-start gap-3", alignClass)}>
                      <span className="text-xl leading-none">
                        {String(w.spec_json.emoji ?? "💡")}
                      </span>
                      <textarea
                        rows={2}
                        value={currentValue}
                        onChange={(e) =>
                          setTextDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                        }
                        onBlur={() => {
                          if (currentValue !== w.spec_json.content) {
                            patchWidgetMut.mutate({
                              id: w.id,
                              targetDashId,
                              spec: { ...w.spec_json, content: currentValue },
                            });
                          }
                        }}
                        placeholder={
                          locale === "en" ? "Callout message..." : "Nội dung ghi chú nổi bật..."
                        }
                        className={cn(
                          "w-full resize-none bg-transparent text-sm font-medium leading-relaxed text-foreground outline-none",
                          alignClass
                        )}
                      />
                    </div>
                  ) : kind === "QUOTE" ? (
                    <blockquote
                      className={cn("border-l-4 border-primary pl-4 italic", alignClass)}
                    >
                      <textarea
                        rows={2}
                        value={currentValue}
                        onChange={(e) =>
                          setTextDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                        }
                        onBlur={() => {
                          if (currentValue !== w.spec_json.content) {
                            patchWidgetMut.mutate({
                              id: w.id,
                              targetDashId,
                              spec: { ...w.spec_json, content: currentValue },
                            });
                          }
                        }}
                        placeholder={
                          locale === "en" ? "Quote..." : "Trích dẫn hoặc châm ngôn..."
                        }
                        className={cn(
                          "w-full resize-none bg-transparent text-base text-foreground outline-none",
                          alignClass
                        )}
                      />
                    </blockquote>
                  ) : kind === "HERO_BANNER" ? (
                    <div className={cn("space-y-1.5 py-1", alignClass)}>
                      <input
                        value={currentValue}
                        onChange={(e) =>
                          setTextDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                        }
                        onBlur={() => {
                          const clean = currentValue.trim() || "LumiPlan Workspace";
                          patchWidgetMut.mutate({
                            id: w.id,
                            targetDashId,
                            title: clean.slice(0, 180),
                            spec: { ...w.spec_json, content: clean },
                          });
                        }}
                        className={cn(
                          "w-full bg-transparent text-2xl font-bold tracking-tight text-foreground outline-none sm:text-3xl",
                          alignClass
                        )}
                      />
                      <p className="text-xs text-primary">Illuminate Your Plans.</p>
                    </div>
                  ) : kind === "COMPOSITE_CARD" ? (
                    <CardSlotRenderer
                      slots={extractSlotsFromSpec(w.spec_json, w.title)}
                      internalCols={Number(w.spec_json.internal_cols ?? 2)}
                      locale={locale}
                      onSlotsChange={(nextSlots) =>
                        patchWidgetMut.mutate({
                          id: w.id,
                          targetDashId,
                          spec: {
                            ...w.spec_json,
                            preset_type: "COMPOSITE_CARD",
                            card_slots: nextSlots,
                          },
                        })
                      }
                    />
                  ) : kind === "CUSTOM_TABLE" ? (
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          value={textDrafts[`${draftKey}-tbl-title`] ?? w.title}
                          onChange={(e) =>
                            setTextDrafts((p) => ({
                              ...p,
                              [`${draftKey}-tbl-title`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const nextT = e.target.value.trim();
                            if (nextT && nextT !== w.title) {
                              patchWidgetMut.mutate({
                                id: w.id,
                                targetDashId,
                                title: nextT,
                              });
                            }
                          }}
                          className="bg-transparent text-base font-bold text-foreground outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cols =
                              (w.spec_json.columns as CustomTableColumn[] | undefined) ?? [];
                            const colId = `col_${Date.now().toString().slice(-4)}`;
                            patchWidgetMut.mutate({
                              id: w.id,
                              targetDashId,
                              spec: {
                                ...w.spec_json,
                                columns: [
                                  ...cols,
                                  { id: colId, label: `Col ${cols.length + 1}`, type: "text" },
                                ],
                              },
                            });
                          }}
                          className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          + {locale === "en" ? "Column" : "Cột"}
                        </button>
                      </div>

                      <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-border/70 text-[11px] text-muted-foreground">
                              {((w.spec_json.columns as CustomTableColumn[] | undefined) ?? []).map(
                                (col, cIdx) => (
                                  <th key={col.id} className="px-2 py-1.5 font-medium">
                                    <input
                                      defaultValue={col.label}
                                      onBlur={(e) => {
                                        const cols = [
                                          ...((w.spec_json.columns as CustomTableColumn[]) ?? []),
                                        ];
                                        cols[cIdx] = { ...col, label: e.target.value || col.label };
                                        patchWidgetMut.mutate({
                                          id: w.id,
                                          targetDashId,
                                          spec: { ...w.spec_json, columns: cols },
                                        });
                                      }}
                                      className="w-full bg-transparent font-medium text-muted-foreground outline-none focus:text-foreground"
                                    />
                                  </th>
                                )
                              )}
                              <th className="w-8" />
                            </tr>
                          </thead>
                          <tbody>
                            {((w.spec_json.rows as CustomTableRow[] | undefined) ?? []).map(
                              (row, rIdx) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-border/40 hover:bg-secondary/20"
                                >
                                  {(
                                    (w.spec_json.columns as CustomTableColumn[] | undefined) ?? []
                                  ).map((col) => (
                                    <td key={col.id} className="px-2 py-1.5">
                                      <input
                                        defaultValue={row.cells?.[col.id] ?? ""}
                                        onBlur={(e) => {
                                          const rows = [
                                            ...((w.spec_json.rows as CustomTableRow[]) ?? []),
                                          ];
                                          rows[rIdx] = {
                                            ...row,
                                            cells: {
                                              ...(row.cells ?? {}),
                                              [col.id]: e.target.value,
                                            },
                                          };
                                          patchWidgetMut.mutate({
                                            id: w.id,
                                            targetDashId,
                                            spec: { ...w.spec_json, rows },
                                          });
                                        }}
                                        className="w-full bg-transparent text-xs text-foreground outline-none"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-1 py-1 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const rows = (
                                          (w.spec_json.rows as CustomTableRow[]) ?? []
                                        ).filter((_, i) => i !== rIdx);
                                        patchWidgetMut.mutate({
                                          id: w.id,
                                          targetDashId,
                                          spec: { ...w.spec_json, rows },
                                        });
                                      }}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const prevRows = (w.spec_json.rows as CustomTableRow[] | undefined) ?? [];
                          patchWidgetMut.mutate({
                            id: w.id,
                            targetDashId,
                            spec: {
                              ...w.spec_json,
                              rows: [...prevRows, { id: `row-${Date.now()}`, cells: {} }],
                            },
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                        <span>{locale === "en" ? "New row" : "Thêm dòng"}</span>
                      </button>
                    </div>
                  ) : kind === "CHECKLIST" ? (
                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold text-foreground">{w.title}</h2>
                      <div className="space-y-1.5">
                        {((w.spec_json.items as ChecklistItem[] | undefined) ?? []).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <label className="flex flex-1 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={(e) => {
                                  const list = (
                                    (w.spec_json.items as ChecklistItem[]) ?? []
                                  ).map((x) =>
                                    x.id === item.id ? { ...x, done: e.target.checked } : x
                                  );
                                  patchWidgetMut.mutate({
                                    id: w.id,
                                    targetDashId,
                                    spec: { ...w.spec_json, items: list },
                                  });
                                }}
                                className="h-3.5 w-3.5 accent-primary"
                              />
                              <span
                                className={item.done ? "line-through text-muted-foreground" : ""}
                              >
                                {item.text}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const list = ((w.spec_json.items as ChecklistItem[]) ?? []).filter(
                                  (x) => x.id !== item.id
                                );
                                patchWidgetMut.mutate({
                                  id: w.id,
                                  targetDashId,
                                  spec: { ...w.spec_json, items: list },
                                });
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const txt = (newCheckInputs[draftKey] ?? "").trim();
                          if (!txt) return;
                          const prev = (w.spec_json.items as ChecklistItem[] | undefined) ?? [];
                          patchWidgetMut.mutate({
                            id: w.id,
                            targetDashId,
                            spec: {
                              ...w.spec_json,
                              items: [...prev, { id: String(Date.now()), text: txt, done: false }],
                            },
                          });
                          setNewCheckInputs((p) => ({ ...p, [draftKey]: "" }));
                        }}
                        className="flex gap-1.5 pt-1"
                      >
                        <input
                          value={newCheckInputs[draftKey] ?? ""}
                          onChange={(e) =>
                            setNewCheckInputs((p) => ({ ...p, [draftKey]: e.target.value }))
                          }
                          placeholder={locale === "en" ? "+ Add item..." : "+ Thêm dòng..."}
                          className="h-7 flex-1 rounded border border-border bg-background/70 px-2 text-xs outline-none"
                        />
                        <button
                          type="submit"
                          className="h-7 rounded border border-border px-2 text-xs hover:bg-secondary"
                        >
                          +
                        </button>
                      </form>
                    </div>
                  ) : kind === "TOGGLE" ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenToggles((p) => ({ ...p, [localWidget.id]: !p[localWidget.id] }))
                        }
                        className="flex w-full items-center gap-1.5 text-left text-sm font-semibold text-foreground"
                      >
                        {openToggles[localWidget.id] ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-primary" />
                        )}
                        <span>{w.title}</span>
                      </button>
                      {openToggles[localWidget.id] && (
                        <textarea
                          rows={3}
                          value={currentValue}
                          onChange={(e) =>
                            setTextDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                          }
                          onBlur={() => {
                            patchWidgetMut.mutate({
                              id: w.id,
                              targetDashId,
                              spec: { ...w.spec_json, content: currentValue },
                            });
                          }}
                          placeholder={
                            locale === "en"
                              ? "Hidden toggle details..."
                              : "Nội dung chi tiết bên trong..."
                          }
                          className="ml-5 w-[calc(100%-1.25rem)] resize-none rounded-lg bg-background/50 p-2 text-xs text-foreground outline-none"
                        />
                      )}
                    </div>
                  ) : kind === "CODE" ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-mono">{String(w.spec_json.language ?? "text")}</span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(currentValue);
                            toast.success("Copied");
                          }}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={currentValue}
                        onChange={(e) =>
                          setTextDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))
                        }
                        onBlur={() => {
                          patchWidgetMut.mutate({
                            id: w.id,
                            targetDashId,
                            spec: { ...w.spec_json, content: currentValue },
                          });
                        }}
                        className="w-full resize-y rounded-lg border border-border bg-background/80 p-3 font-mono text-xs text-foreground outline-none"
                      />
                    </div>
                  ) : kind === "DIVIDER" ? (
                    <hr
                      className={cn(
                        "my-1 border-border",
                        w.spec_json.dashed ? "border-dashed" : "border-solid"
                      )}
                    />
                  ) : kind === "KPI_STAT" ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {locale === "en" ? "Current Streak" : "Chuỗi ngày liên tiếp"}
                        </p>
                        <p className="mt-0.5 font-mono text-2xl font-bold text-primary">
                          {streakQuery.data?.current_streak ?? 0}d
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {locale === "en" ? "Completion Rate" : "Tỷ lệ hoàn thành"}
                        </p>
                        <p className="mt-0.5 font-mono text-2xl font-bold text-foreground">
                          {overviewQuery.data?.metrics?.completion_rate ?? 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {locale === "en" ? "Focus Minutes" : "Phút tập trung"}
                        </p>
                        <p className="mt-0.5 font-mono text-2xl font-bold text-foreground">
                          {overviewQuery.data?.metrics?.active_minutes ?? 0}m
                        </p>
                      </div>
                    </div>
                  ) : kind === "PLAN_DB" ? (
                    <PlanDatabaseBlock
                      initialTitle={w.title || "DB Kế hoạch"}
                      initialPeriodType={
                        (w.spec_json.period_type as PeriodType | undefined) ?? "WEEK"
                      }
                      onSpecPatch={(patch) =>
                        patchWidgetMut.mutate({
                          id: w.id,
                          targetDashId,
                          spec: { ...w.spec_json, ...patch },
                        })
                      }
                    />
                  ) : kind === "PROJECT_DB" ? (
                    <ProjectDatabaseBlock initialTitle={w.title || "DB Project"} />
                  ) : kind === "TODAY_TIMELINE" ? (
                    <NotionTaskDatabase
                      initialTitle={w.title || "Today Timeline"}
                      onTitleChange={(next) =>
                        patchWidgetMut.mutate({
                          id: w.id,
                          targetDashId,
                          title: next.slice(0, 180),
                        })
                      }
                    />
                  ) : kind === "HABITS_PANEL" ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground">{w.title}</h2>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (newHabitTitle.trim()) createHabitMut.mutate();
                          }}
                          className="flex gap-1.5"
                        >
                          <input
                            value={newHabitTitle}
                            onChange={(e) => setNewHabitTitle(e.target.value)}
                            placeholder={locale === "en" ? "+ Habit..." : "+ Thói quen..."}
                            className="h-7 w-32 rounded border border-input bg-background px-2 text-xs"
                          />
                          <button
                            type="submit"
                            className="h-7 rounded bg-primary px-2 text-xs text-primary-foreground"
                          >
                            +
                          </button>
                        </form>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(habitsQuery.data ?? []).map((h) => {
                          const done = h.logs.some(
                            (l) => l.log_date === todayIso && l.status === "COMPLETED"
                          );
                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() =>
                                logHabitMut.mutate({
                                  habitId: h.id,
                                  status: done ? "SKIPPED" : "COMPLETED",
                                })
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                                done
                                  ? "border-emerald-500/60 bg-emerald-500/15"
                                  : "border-border bg-background hover:bg-secondary"
                              )}
                            >
                              <Check
                                className={cn("h-3 w-3", done ? "text-emerald-500" : "opacity-40")}
                              />
                              <span>{h.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : kind === "GOALS_PANEL" ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground">{w.title}</h2>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (newGoalTitle.trim()) createGoalMut.mutate();
                          }}
                          className="flex gap-1.5"
                        >
                          <input
                            value={newGoalTitle}
                            onChange={(e) => setNewGoalTitle(e.target.value)}
                            placeholder={locale === "en" ? "+ Goal..." : "+ Mục tiêu..."}
                            className="h-7 w-32 rounded border border-input bg-background px-2 text-xs"
                          />
                          <button
                            type="submit"
                            className="h-7 rounded bg-primary px-2 text-xs text-primary-foreground"
                          >
                            +
                          </button>
                        </form>
                      </div>
                      <div className="space-y-2.5">
                        {(goalsQuery.data ?? []).map((g) => (
                          <div key={g.id} className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{g.title}</span>
                              <span className="font-mono text-primary">{g.progress_percent}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                style={{ width: `${Math.min(100, g.progress_percent)}%` }}
                                className="h-full bg-primary"
                              />
                            </div>
                            {g.milestones.slice(0, 3).map((m) => (
                              <label key={m.id} className="flex items-center gap-1.5 text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={m.status === "COMPLETED"}
                                  onChange={(e) =>
                                    toggleMsMut.mutate({
                                      goalId: g.id,
                                      msId: m.id,
                                      status: e.target.checked ? "COMPLETED" : "PENDING",
                                    })
                                  }
                                  className="h-3 w-3 accent-primary"
                                />
                                <span
                                  className={
                                    m.status === "COMPLETED"
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }
                                >
                                  {m.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : chartKey ? (
                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold text-foreground">{w.title}</h2>
                      <DynamicChartCard chartKey={chartKey} filters={filters} />
                    </div>
                  ) : kind === "STREAK" ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Flame className="h-7 w-7 text-primary" />
                        <div>
                          <p className="font-mono text-2xl font-bold">
                            {streakQuery.data?.current_streak ?? 0}d
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Best {streakQuery.data?.best_streak ?? 0}d · 30d{" "}
                            {streakQuery.data?.consistency_30d ?? 0}%
                          </p>
                        </div>
                      </div>
                      <Link href="/analytics" className="text-xs text-primary hover:underline">
                        Analytics →
                      </Link>
                    </div>
                  ) : kind === "TODAY_TASKS" ? (
                    <div className="space-y-1.5 text-xs">
                      <h2 className="mb-2 text-sm font-semibold text-foreground">{w.title}</h2>
                      {(todayOccsQuery.data?.items ?? []).slice(0, 6).map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between border-b border-border/50 py-1.5"
                        >
                          <span
                            className={
                              t.status === "DONE"
                                ? "line-through text-muted-foreground"
                                : "font-medium"
                            }
                          >
                            {t.task.title}
                          </span>
                          <span className="text-muted-foreground">{t.status}</span>
                        </div>
                      ))}
                      <Link href="/todo-list" className="inline-block pt-1 text-primary hover:underline">
                        Todo List →
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{w.title}</p>
                  )}
                </div>

                {/* Mouse Drag Resize Handles (Only active when Khung ô is enabled) */}
                {showGridGuides && !syncedBroken && (
                  <>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Resize width"
                      onPointerDown={(e) => startMouseResize(e, localWidget, "x")}
                      className="absolute right-0 top-3 bottom-3 w-1.5 cursor-ew-resize rounded-full bg-primary/25 transition-colors hover:bg-primary/60"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Resize height"
                      onPointerDown={(e) => startMouseResize(e, localWidget, "y")}
                      className="absolute left-3 right-3 bottom-0 h-1.5 cursor-ns-resize rounded-full bg-primary/25 transition-colors hover:bg-primary/60"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Resize block corner"
                      onPointerDown={(e) => startMouseResize(e, localWidget, "both")}
                      title={
                        locale === "en" ? "Drag to resize block" : "Kéo chuột thu nhỏ / phóng to"
                      }
                      className="absolute right-0.5 bottom-0.5 h-3.5 w-3.5 cursor-nwse-resize rounded-br border-b-2 border-r-2 border-primary/70 transition-colors hover:border-primary"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* Centered Bottom + Thêm block button (subtle muted opacity -> crisp on hover, matching Image 1) */}
      <div
        className={cn(
          "flex justify-center",
          widgets.length === 0 ? "flex-1 items-center" : "mt-6 pb-8"
        )}
      >
        <button
          type="button"
          onClick={openAddBlockModal}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-card/70 px-4 text-xs font-medium text-muted-foreground opacity-45 shadow-xs transition-all hover:border-primary/60 hover:bg-card hover:text-foreground hover:opacity-100 focus-visible:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{locale === "en" ? "Add block" : "Thêm block"}</span>
        </button>
      </div>

      {/* Block Library Modal backed by Admin Block Templates + Import from Other Page */}
      {showAddModal && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <h2 className="text-base font-semibold">
                {locale === "en" ? "Add Block" : "Thêm Block"}
              </h2>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link
                    href="/admin/templates"
                    onClick={() => setShowAddModal(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-secondary"
                  >
                    <Settings2 className="h-3 w-3" />
                    <span>{locale === "en" ? "Manage Templates" : "Quản lý Mẫu"}</span>
                  </Link>
                )}
                <button type="button" onClick={() => setShowAddModal(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <input
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder={
                locale === "en"
                  ? "Search blocks, forms, charts..."
                  : "Tìm block, form mẫu, biểu đồ..."
              }
              className="mb-4 h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
            />

            {(
              [
                ["TEXT_FORMAT", locale === "en" ? "Text & Formatting" : "Nội dung & Định dạng"],
                ["FORM_TABLE", locale === "en" ? "Structured Forms & Tables" : "Bảng & Form mẫu"],
                ["PRODUCTIVITY", locale === "en" ? "Productivity Modules" : "Khối Năng suất"],
                ["CHART", locale === "en" ? "19 Dynamic Charts" : "Biểu đồ động"],
              ] as const
            ).map(([catKey, catLabel]) => {
              const items = categorizedTemplates[catKey] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={catKey} className="mb-5">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {catLabel}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {items.map((tpl) => {
                      const Icon = TEMPLATE_ICONS[tpl.icon_name] ?? Sparkles;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => addFromTemplate(tpl)}
                          className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-3 text-left text-xs hover:border-primary"
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {locale === "en" ? tpl.name_en : tpl.name_vi}
                            </p>
                            <p className="line-clamp-2 text-[10px] text-muted-foreground">
                              {locale === "en" ? tpl.description_en : tpl.description_vi}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Copy / Sync Block from Another Page */}
            <div className="space-y-3 border-t border-border pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {locale === "en" ? "Import from another page" : "Lấy block từ trang khác"}
                </h3>
                <div className="flex rounded-lg border border-border bg-background p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setImportMode("copy")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      importMode === "copy"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {locale === "en" ? "Independent Copy" : "Copy độc lập"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("sync")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      importMode === "sync"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {locale === "en" ? "2-Way Synced Block" : "Đồng bộ 2 chiều"}
                  </button>
                </div>
              </div>

              {otherDashboards.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {locale === "en"
                    ? "Create another page first to copy or sync blocks."
                    : "Chưa có trang nào khác để lấy block."}
                </p>
              ) : (
                <div className="space-y-3">
                  <select
                    aria-label={locale === "en" ? "Source page" : "Chọn trang nguồn"}
                    value={importSourceDashId}
                    onChange={(e) => {
                      setImportSourceDashId(e.target.value);
                      setSelectedImportIds([]);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    {otherDashboards.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>

                  {importSourceDashQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">...</p>
                  ) : (importSourceDashQuery.data?.widgets ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {locale === "en"
                        ? "Selected page has no blocks."
                        : "Trang này chưa có block nào."}
                    </p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {(importSourceDashQuery.data?.widgets ?? []).map((item) => {
                        const checked = selectedImportIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                              checked
                                ? "border-primary bg-accent/60"
                                : "border-border bg-background hover:bg-secondary/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedImportIds((prev) =>
                                  e.target.checked
                                    ? [...prev, item.id]
                                    : prev.filter((id) => id !== item.id)
                                );
                              }}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            <span className="truncate font-medium text-foreground">
                              {item.title}
                            </span>
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {String(item.spec_json.preset_type ?? item.widget_kind)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {selectedImportIds.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={importFromOtherMut.isPending}
                        onClick={() => importFromOtherMut.mutate()}
                        className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {locale === "en"
                          ? `Add ${selectedImportIds.length} block(s)`
                          : `Thêm ${selectedImportIds.length} block đã chọn`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send / Copy Block to Another Page Modal */}
      {sendingWidget && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSendingWidget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-semibold">
                {locale === "en" ? "Send / Copy Block" : "Gửi / Copy Block tới trang khác"}
              </h2>
              <button type="button" onClick={() => setSendingWidget(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="grid gap-1.5 font-medium">
              {locale === "en" ? "Destination Page" : "Trang đích"}
              <select
                value={sendDestDashId}
                onChange={(e) => setSendDestDashId(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2.5"
              >
                {otherDashboards.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSendMode("copy")}
                className={cn(
                  "rounded-lg border px-3 py-2 font-medium",
                  sendMode === "copy"
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border"
                )}
              >
                {locale === "en" ? "Independent Copy" : "Copy độc lập"}
              </button>
              <button
                type="button"
                onClick={() => setSendMode("sync")}
                className={cn(
                  "rounded-lg border px-3 py-2 font-medium",
                  sendMode === "sync"
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border"
                )}
              >
                {locale === "en" ? "2-Way Synced Block" : "Đồng bộ 2 chiều"}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSendingWidget(null)}
                className="h-9 rounded-lg border border-border px-3 font-medium hover:bg-secondary"
              >
                {locale === "en" ? "Cancel" : "Hủy"}
              </button>
              <button
                type="button"
                disabled={!sendDestDashId || sendToOtherMut.isPending}
                onClick={() => sendToOtherMut.mutate()}
                className="h-9 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
              >
                {locale === "en" ? "Send" : "Thực hiện"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Block Customizer Modal (Title, Border Style/Width/Color, Grid Size, Surface) */}
      {editingWidget && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingWidget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={cn(
              "max-h-[88vh] w-full space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-xs shadow-xl",
              editHasCompositeSlots ? "max-w-4xl" : "max-w-lg"
            )}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-semibold">
                {locale === "en" ? "Customize Block" : "Tùy biến Block & Viền"}
              </h2>
              <button type="button" onClick={() => setEditingWidget(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="grid gap-1 font-medium">
              {locale === "en" ? "Block Title" : "Tên / Tiêu đề Block"}
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm font-normal"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 font-medium">
                {locale === "en"
                  ? `Width (${gridCols}-col grid)`
                  : `Số cột chiếm (trên ${gridCols} cột)`}
                <select
                  value={editColSpan}
                  onChange={(e) => setEditColSpan(Number(e.target.value))}
                  className="h-9 rounded-lg border border-input bg-background px-2"
                >
                  {Array.from({ length: gridCols }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>
                      {c} / {gridCols} {c === gridCols ? "(Full)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-1 font-medium">
                <span>{locale === "en" ? "Height" : "Chiều cao"}</span>
                <div className="flex items-center gap-2">
                  <select
                    disabled={!editCustomHeight}
                    value={editHeightRows}
                    onChange={(e) => setEditHeightRows(Number(e.target.value))}
                    className="h-9 flex-1 rounded-lg border border-input bg-background px-2 disabled:opacity-50"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((r) => (
                      <option key={r} value={r}>
                        {r} hàng ({r * 64}px)
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-[11px] font-normal">
                    <input
                      type="checkbox"
                      checked={!editCustomHeight}
                      onChange={(e) => setEditCustomHeight(!e.target.checked)}
                      className="accent-primary"
                    />
                    <span>Auto</span>
                  </label>
                </div>
              </div>

              <label className="grid gap-1 font-medium">
                {locale === "en" ? "Border Style" : "Kiểu viền"}
                <select
                  value={editBorder}
                  onChange={(e) => setEditBorder(e.target.value as BlockBorder)}
                  className="h-9 rounded-lg border border-input bg-background px-2"
                >
                  <option value="none">{locale === "en" ? "No Border" : "Không viền"}</option>
                  <option value="hairline">{locale === "en" ? "Hairline" : "Viền mảnh"}</option>
                  <option value="solid">{locale === "en" ? "Solid Line" : "Viền liền"}</option>
                  <option value="dashed">{locale === "en" ? "Dashed" : "Nét đứt"}</option>
                  <option value="dotted">{locale === "en" ? "Dotted" : "Chấm bi"}</option>
                  <option value="double">{locale === "en" ? "Double" : "Viền đôi"}</option>
                  <option value="shadow">{locale === "en" ? "Shadow" : "Đổ bóng"}</option>
                </select>
              </label>

              <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                <label className="grid gap-1 font-medium">
                  Độ dày
                  <select
                    disabled={editBorder === "none" || editBorder === "hairline" || editBorder === "shadow"}
                    value={editBorderWidth}
                    onChange={(e) => setEditBorderWidth(Number(e.target.value))}
                    className="h-9 rounded-lg border border-input bg-background px-1.5 disabled:opacity-50"
                  >
                    <option value={1}>1px</option>
                    <option value={2}>2px</option>
                    <option value={3}>3px</option>
                    <option value={4}>4px</option>
                  </select>
                </label>

                <label className="grid gap-1 font-medium">
                  Màu viền
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      disabled={editBorder === "none" || editBorder === "hairline" || editBorder === "shadow"}
                      value={editBorderColor}
                      onChange={(e) => setEditBorderColor(e.target.value)}
                      className="h-9 w-10 cursor-pointer rounded border border-input bg-background p-0.5 disabled:opacity-40"
                    />
                    <input
                      disabled={editBorder === "none" || editBorder === "hairline" || editBorder === "shadow"}
                      value={editBorderColor}
                      onChange={(e) => setEditBorderColor(e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 font-mono disabled:opacity-50"
                    />
                  </div>
                </label>
              </div>

              <label className="grid gap-1 font-medium">
                {locale === "en" ? "Surface Color" : "Màu nền"}
                <select
                  value={editSurface}
                  onChange={(e) => setEditSurface(e.target.value as BlockSurface)}
                  className="h-9 rounded-lg border border-input bg-background px-2"
                >
                  <option value="paper">Transparent</option>
                  <option value="card">Card</option>
                  <option value="blue">Soft Blue</option>
                  <option value="lavender">Lavender</option>
                  <option value="sage">Sage</option>
                  <option value="peach">Peach</option>
                  <option value="rose">Rose</option>
                  <option value="butter">Butter</option>
                </select>
              </label>

              <label className="grid gap-1 font-medium">
                {locale === "en" ? "Alignment" : "Căn lề"}
                <select
                  value={editAlign}
                  onChange={(e) => setEditAlign(e.target.value as BlockAlign)}
                  className="h-9 rounded-lg border border-input bg-background px-2"
                >
                  <option value="left">{locale === "en" ? "Left" : "Trái"}</option>
                  <option value="center">{locale === "en" ? "Center" : "Giữa"}</option>
                  <option value="right">{locale === "en" ? "Right" : "Phải"}</option>
                </select>
              </label>

              <label className="grid gap-1 font-medium">
                {locale === "en" ? "Corner Radius" : "Bo góc"}
                <select
                  value={editRadius}
                  onChange={(e) => setEditRadius(e.target.value as BlockRadius)}
                  className="h-9 rounded-lg border border-input bg-background px-2"
                >
                  <option value="none">{locale === "en" ? "Sharp" : "Vuông"}</option>
                  <option value="md">{locale === "en" ? "Medium" : "Vừa"}</option>
                  <option value="2xl">{locale === "en" ? "Rounded" : "Bo tròn"}</option>
                </select>
              </label>

              <label className="grid gap-1 font-medium">
                {locale === "en" ? "Padding" : "Khoảng đệm"}
                <select
                  value={editPadding}
                  onChange={(e) => setEditPadding(e.target.value as BlockPadding)}
                  className="h-9 rounded-lg border border-input bg-background px-2"
                >
                  <option value="none">{locale === "en" ? "None" : "Không đệm"}</option>
                  <option value="sm">{locale === "en" ? "Compact" : "Gọn"}</option>
                  <option value="md">{locale === "en" ? "Normal" : "Vừa"}</option>
                  <option value="lg">{locale === "en" ? "Spacious" : "Thoáng"}</option>
                </select>
              </label>
            </div>

            {typeof editingWidget.widget.spec_json.chart_key === "string" && (
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                <label className="grid gap-1 font-medium">
                  Project
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    <option value="">All</option>
                    {(projectsQuery.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 font-medium">
                  Group By
                  <select
                    value={editGroupBy}
                    onChange={(e) => setEditGroupBy(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    <option value="project">Project</option>
                    <option value="category">Category</option>
                    <option value="tag">Tag</option>
                  </select>
                </label>
              </div>
            )}

            {editHasCompositeSlots && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="font-semibold text-foreground">
                  {locale === "en"
                    ? "Internal Card Layout (Drag & Drop)"
                    : "Bố cục từng thành phần bên trong Card (Kéo thả)"}
                </p>
                <CardLayoutStudio
                  slots={editCardSlots}
                  internalCols={editInternalCols}
                  locale={locale}
                  onChange={(nextSlots, nextCols) => {
                    setEditCardSlots(nextSlots);
                    setEditInternalCols(nextCols);
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              {isAdmin ? (
                <Link
                  href="/admin/templates"
                  onClick={() => setEditingWidget(null)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {locale === "en" ? "Edit global template in Admin →" : "Chỉnh mẫu gốc trong Admin →"}
                </Link>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={async () => {
                  const nextWidth12 = Math.min(
                    12,
                    Math.max(1, Math.round((editColSpan / gridCols) * 12))
                  );
                  if (editingWidget.localId !== editingWidget.widget.id) {
                    await patchWidgetMut.mutateAsync({
                      id: editingWidget.localId,
                      targetDashId: dashboardId,
                      width: nextWidth12,
                      height: editHeightRows,
                    });
                  }
                  patchWidgetMut.mutate({
                    id: editingWidget.widget.id,
                    targetDashId: editingWidget.targetDashId,
                    title: editTitle.trim() || editingWidget.widget.title,
                    ...(editingWidget.localId === editingWidget.widget.id
                      ? { width: nextWidth12, height: editHeightRows }
                      : {}),
                    spec: {
                      ...editingWidget.widget.spec_json,
                      grid_col_span: editColSpan,
                      custom_height: editCustomHeight,
                      align: editAlign,
                      surface: editSurface,
                      border: editBorder,
                      border_width: editBorderWidth,
                      border_color: editBorderColor,
                      radius: editRadius,
                      padding: editPadding,
                      filters: {
                        project_id: editProjectId || null,
                        group_by: editGroupBy,
                      },
                      ...(editHasCompositeSlots
                        ? {
                            preset_type: "COMPOSITE_CARD",
                            internal_cols: editInternalCols,
                            card_slots: editCardSlots,
                          }
                        : {}),
                    },
                  });
                }}
                className="h-9 rounded-lg bg-primary px-4 font-medium text-primary-foreground"
              >
                {locale === "en" ? "Apply" : "Áp dụng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
