"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Search, Trash2, Unlock, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  adminCreateBlockTemplate,
  adminDeleteBlockTemplate,
  adminListBlockTemplates,
  adminPatchBlockTemplate,
} from "@/features/dashboards/api";
import { CardLayoutStudio } from "@/features/dashboards/card-layout-studio";
import { extractSlotsFromSpec, type CardSlot } from "@/features/dashboards/card-slots";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { BlockTemplate, TemplateCategory } from "@/types/domain";

interface TableCol {
  id: string;
  label: string;
  type: "text" | "number";
}

interface TableRow {
  id: string;
  cells: Record<string, string>;
}

const CATEGORY_LABELS: Record<TemplateCategory, { vi: string; en: string }> = {
  TEXT_FORMAT: { vi: "Nội dung & Định dạng", en: "Text & Format" },
  FORM_TABLE: { vi: "Bảng & Form mẫu", en: "Forms & Tables" },
  PRODUCTIVITY: { vi: "Năng suất", en: "Productivity" },
  CHART: { vi: "Biểu đồ động", en: "Dynamic Charts" },
};

const BORDER_OPTIONS = [
  { value: "none", vi: "Không viền", en: "None" },
  { value: "hairline", vi: "Viền mảnh", en: "Hairline" },
  { value: "solid", vi: "Viền liền (Solid)", en: "Solid" },
  { value: "dashed", vi: "Nét đứt (Dashed)", en: "Dashed" },
  { value: "dotted", vi: "Chấm (Dotted)", en: "Dotted" },
  { value: "double", vi: "Viền đôi (Double)", en: "Double" },
  { value: "shadow", vi: "Đổ bóng", en: "Shadow" },
] as const;

export default function AdminTemplatesPage() {
  const { locale } = useI18n();
  const client = useQueryClient();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });

  const templatesQuery = useQuery({
    queryKey: ["admin-block-templates"],
    queryFn: adminListBlockTemplates,
    enabled: meQuery.data?.role === "ADMIN",
  });

  const [categoryFilter, setCategoryFilter] = useState<"ALL" | TemplateCategory>("ALL");
  const [search, setSearch] = useState("");

  // Modal state (either editing existing template or creating a new one)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlockTemplate | null>(null);

  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("FORM_TABLE");
  const [nameVi, setNameVi] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descVi, setDescVi] = useState("");
  const [descEn, setDescEn] = useState("");
  const [widgetKind, setWidgetKind] = useState<BlockTemplate["widget_kind"]>("TASK_LIST");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultWidth, setDefaultWidth] = useState(6);
  const [defaultHeight, setDefaultHeight] = useState(4);
  const [isActive, setIsActive] = useState(true);
  const [isCustomizable, setIsCustomizable] = useState(true);
  const [sortOrder, setSortOrder] = useState(50);

  // Spec styling fields
  const [surface, setSurface] = useState("card");
  const [borderStyle, setBorderStyle] = useState("hairline");
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderColor, setBorderColor] = useState("#5D83BB");
  const [radius, setRadius] = useState("2xl");
  const [padding, setPadding] = useState("md");
  const [align, setAlign] = useState("left");
  const [defaultContent, setDefaultContent] = useState("");

  // Structured Form / Table columns & rows editor + Visual Card Layout Builder
  const [modalTab, setModalTab] = useState<"layout" | "appearance">("layout");
  const [internalCols, setInternalCols] = useState(2);
  const [cardSlots, setCardSlots] = useState<CardSlot[]>([]);
  const [useCompositeLayout, setUseCompositeLayout] = useState(false);
  const [tableCols, setTableCols] = useState<TableCol[]>([]);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawSpecJson, setRawSpecJson] = useState("{}");

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (templatesQuery.data ?? []).filter((tpl) => {
      if (categoryFilter !== "ALL" && tpl.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        tpl.name_vi.toLowerCase().includes(q) ||
        tpl.name_en.toLowerCase().includes(q) ||
        tpl.slug.toLowerCase().includes(q) ||
        tpl.default_title.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, search, templatesQuery.data]);

  function openCreateModal() {
    setEditing(null);
    setSlug(`custom-form-${Date.now().toString().slice(-4)}`);
    setCategory("FORM_TABLE");
    setNameVi("Form tùy chỉnh mới");
    setNameEn("New Custom Form");
    setDescVi("Form / Bảng dữ liệu tùy biến");
    setDescEn("Customizable structured form");
    setWidgetKind("TASK_LIST");
    setDefaultTitle("Custom Form");
    setDefaultWidth(12);
    setDefaultHeight(4);
    setIsActive(true);
    setIsCustomizable(true);
    setSortOrder(105);
    setSurface("card");
    setBorderStyle("solid");
    setBorderWidth(1);
    setBorderColor("#5D83BB");
    setRadius("2xl");
    setPadding("md");
    setAlign("left");
    setDefaultContent("");
    setTableCols([
      { id: "col_1", label: "Mục", type: "text" },
      { id: "col_2", label: "Chỉ tiêu", type: "text" },
    ]);
    setTableRows([{ id: "r1", cells: { col_1: "Tuần 1", col_2: "Hoàn thành" } }]);
    setUseCompositeLayout(true);
    setInternalCols(2);
    setCardSlots(
      extractSlotsFromSpec(
        {
          preset_type: "COMPOSITE_CARD",
        },
        "Custom Card"
      )
    );
    setModalTab("layout");
    setRawJsonMode(false);
    setRawSpecJson(JSON.stringify({ preset_type: "COMPOSITE_CARD" }, null, 2));
    setModalOpen(true);
  }

  function openEditModal(tpl: BlockTemplate) {
    const spec = tpl.default_spec_json ?? {};
    setEditing(tpl);
    setSlug(tpl.slug);
    setCategory(tpl.category);
    setNameVi(tpl.name_vi);
    setNameEn(tpl.name_en);
    setDescVi(tpl.description_vi);
    setDescEn(tpl.description_en);
    setWidgetKind(tpl.widget_kind);
    setDefaultTitle(tpl.default_title);
    setDefaultWidth(tpl.default_width);
    setDefaultHeight(tpl.default_height);
    setIsActive(tpl.is_active);
    setIsCustomizable(tpl.is_user_customizable);
    setSortOrder(tpl.sort_order);

    setSurface(String(spec.surface ?? "card"));
    setBorderStyle(String(spec.border ?? "hairline"));
    setBorderWidth(Number(spec.border_width ?? 1));
    setBorderColor(String(spec.border_color ?? "#5D83BB"));
    setRadius(String(spec.radius ?? "2xl"));
    setPadding(String(spec.padding ?? "md"));
    setAlign(String(spec.align ?? "left"));
    setDefaultContent(typeof spec.content === "string" ? spec.content : "");
    setTableCols(Array.isArray(spec.columns) ? (spec.columns as TableCol[]) : []);
    setTableRows(Array.isArray(spec.rows) ? (spec.rows as TableRow[]) : []);
    const isComposite =
      spec.preset_type === "COMPOSITE_CARD" ||
      (Array.isArray(spec.card_slots) && spec.card_slots.length > 0);
    setUseCompositeLayout(isComposite || tpl.category === "TEXT_FORMAT" || tpl.category === "FORM_TABLE");
    setInternalCols(Number(spec.internal_cols ?? 2));
    setCardSlots(extractSlotsFromSpec(spec, tpl.default_title));
    setModalTab("layout");
    setRawJsonMode(false);
    setRawSpecJson(JSON.stringify(spec, null, 2));
    setModalOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      let nextSpec: Record<string, unknown>;
      if (rawJsonMode) {
        nextSpec = JSON.parse(rawSpecJson) as Record<string, unknown>;
      } else {
        nextSpec = {
          ...(editing?.default_spec_json ?? { preset_type: "COMPOSITE_CARD" }),
          surface,
          border: borderStyle,
          border_width: borderWidth,
          border_color: borderColor,
          radius,
          padding,
          align,
          ...(defaultContent ? { content: defaultContent } : {}),
          ...(useCompositeLayout
            ? {
                preset_type: "COMPOSITE_CARD",
                internal_cols: internalCols,
                card_slots: cardSlots,
              }
            : (category === "FORM_TABLE" ||
                editing?.default_spec_json?.preset_type === "CUSTOM_TABLE") &&
              tableCols.length > 0
              ? { preset_type: "CUSTOM_TABLE", columns: tableCols, rows: tableRows }
              : {}),
        };
      }

      if (editing) {
        return adminPatchBlockTemplate(editing.id, {
          category,
          name_vi: nameVi,
          name_en: nameEn,
          description_vi: descVi,
          description_en: descEn,
          widget_kind: widgetKind,
          default_title: defaultTitle,
          default_width: defaultWidth,
          default_height: defaultHeight,
          default_spec_json: nextSpec,
          is_active: isActive,
          is_user_customizable: isCustomizable,
          sort_order: sortOrder,
        });
      }
      return adminCreateBlockTemplate({
        slug: slug.trim().toLowerCase(),
        category,
        name_vi: nameVi,
        name_en: nameEn,
        description_vi: descVi,
        description_en: descEn,
        icon_name: category === "FORM_TABLE" ? "Table2" : "Sparkles",
        widget_kind: widgetKind,
        default_title: defaultTitle,
        default_width: defaultWidth,
        default_height: defaultHeight,
        default_spec_json: nextSpec,
        is_active: isActive,
        is_user_customizable: isCustomizable,
        sort_order: sortOrder,
      });
    },
    onSuccess: async () => {
      setModalOpen(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin-block-templates"] }),
        client.invalidateQueries({ queryKey: ["block-templates"] }),
      ]);
      toast.success(locale === "en" ? "Template saved" : "Đã lưu form / card mẫu");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  const quickToggleMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{ is_active: boolean; is_user_customizable: boolean }>;
    }) => adminPatchBlockTemplate(id, patch),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin-block-templates"] }),
        client.invalidateQueries({ queryKey: ["block-templates"] }),
      ]);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteBlockTemplate(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin-block-templates"] }),
        client.invalidateQueries({ queryKey: ["block-templates"] }),
      ]);
      toast.success(locale === "en" ? "Template deleted" : "Đã xóa mẫu");
    },
  });

  if (meQuery.data && meQuery.data.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-destructive/40 bg-card p-6 text-sm text-destructive">
        403 — Chỉ quản trị viên (ADMIN) mới có quyền quản lý Form & Card mẫu.
      </div>
    );
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    saveMut.mutate();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {locale === "en" ? "Form & Card Templates" : "Quản lý Form & Card mẫu"}
          </h1>
          <nav className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
            <Link
              href="/admin/users"
              className="rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground"
            >
              {locale === "en" ? "Users" : "Tài khoản"}
            </Link>
            <span className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              {locale === "en" ? "Form & Card Templates" : "Form & Card mẫu"}
            </span>
          </nav>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          <span>{locale === "en" ? "New Template" : "Tạo Form / Card mẫu"}</span>
        </button>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "en" ? "Search templates..." : "Tìm form / card mẫu..."}
              className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            {(["ALL", "TEXT_FORMAT", "FORM_TABLE", "PRODUCTIVITY", "CHART"] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "h-9 rounded-lg border px-3 font-medium transition-colors",
                    categoryFilter === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat === "ALL"
                    ? locale === "en"
                      ? "All"
                      : "Tất cả"
                    : CATEGORY_LABELS[cat][locale]}
                </button>
              )
            )}
          </div>
        </div>

        {templatesQuery.isLoading ? (
          <p className="py-6 text-sm text-muted-foreground">...</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => openEditModal(tpl)}
                className={cn(
                  "flex cursor-pointer flex-col justify-between gap-3 rounded-xl border border-border bg-background p-4 text-xs transition-colors hover:border-primary/70",
                  !tpl.is_active && "opacity-55"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {locale === "en" ? tpl.name_en : tpl.name_vi}
                  </h2>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Xóa mẫu "${tpl.name_vi}"?`)) {
                        deleteMut.mutate(tpl.id);
                      }
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div
                  className="flex flex-wrap items-center justify-between gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        quickToggleMut.mutate({
                          id: tpl.id,
                          patch: { is_active: !tpl.is_active },
                        })
                      }
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-medium",
                        tpl.is_active
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {tpl.is_active
                        ? locale === "en"
                          ? "Visible"
                          : "Đang bật"
                        : locale === "en"
                          ? "Hidden"
                          : "Đang ẩn"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickToggleMut.mutate({
                          id: tpl.id,
                          patch: { is_user_customizable: !tpl.is_user_customizable },
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
                        tpl.is_user_customizable
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-500/15 text-amber-500"
                      )}
                    >
                      {tpl.is_user_customizable ? (
                        <Unlock className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      <span>{tpl.is_user_customizable ? "User Custom" : "Locked"}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditModal(tpl)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>{locale === "en" ? "Edit" : "Sửa"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admin Template Editor Modal */}
      {modalOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleFormSubmit}
            className="max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-xs shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <h2 className="text-base font-semibold text-foreground">
                {editing
                  ? `${locale === "en" ? "Edit Template" : "Chỉnh sửa mẫu"}: ${editing.name_vi}`
                  : locale === "en"
                    ? "Create Form / Card Template"
                    : "Tạo Form / Card mẫu mới"}
              </h2>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setUseCompositeLayout(true);
                      setModalTab("layout");
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      modalTab === "layout"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Bố cục bên trong Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("appearance")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      modalTab === "appearance"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Thông tin & Viền ngoài
                  </button>
                </div>
                <button type="button" onClick={() => setModalOpen(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {modalTab === "layout" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={useCompositeLayout}
                        onChange={(e) => setUseCompositeLayout(e.target.checked)}
                        className="accent-primary"
                      />
                      <span>Bố cục đa thành phần</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">Khung Card:</span>
                      <select
                        value={defaultWidth}
                        onChange={(e) => setDefaultWidth(Number(e.target.value))}
                        className="h-7 rounded border border-input bg-background px-1.5"
                      >
                        {[3, 4, 6, 8, 12].map((w) => (
                          <option key={w} value={w}>
                            {w}/12 cột
                          </option>
                        ))}
                      </select>
                      <span>×</span>
                      <select
                        value={defaultHeight}
                        onChange={(e) => setDefaultHeight(Number(e.target.value))}
                        className="h-7 rounded border border-input bg-background px-1.5"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((h) => (
                          <option key={h} value={h}>
                            {h} hàng
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {cardSlots.length} thành phần · {internalCols} cột
                  </span>
                </div>

                {useCompositeLayout ? (
                  <CardLayoutStudio
                    slots={cardSlots}
                    internalCols={internalCols}
                    locale={locale}
                    onChange={(nextSlots, nextCols) => {
                      setCardSlots(nextSlots);
                      setInternalCols(nextCols);
                    }}
                  />
                ) : (
                  <p className="py-4 text-muted-foreground">
                    Mẫu này hiện đang dùng trình render cố định của hệ thống. Tích chọn ô phía trên nếu bạn muốn chuyển mẫu sang bố cục kéo-thả nhiều thành phần bên trong Card.
                  </p>
                )}
              </div>
            ) : (
              <>

            <div className="grid gap-3 sm:grid-cols-2">
              {!editing && (
                <label className="grid gap-1 font-medium">
                  Slug (lowercase-dash)
                  <input
                    required
                    pattern="^[a-z0-9-]+$"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2.5 font-mono"
                  />
                </label>
              )}

              <label className="grid gap-1 font-medium">
                {locale === "en" ? "Category" : "Nhóm mẫu"}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                >
                  <option value="TEXT_FORMAT">Nội dung & Định dạng</option>
                  <option value="FORM_TABLE">Bảng & Form mẫu</option>
                  <option value="PRODUCTIVITY">Năng suất</option>
                  <option value="CHART">Biểu đồ động</option>
                </select>
              </label>

              <label className="grid gap-1 font-medium">
                Tên tiếng Việt
                <input
                  required
                  value={nameVi}
                  onChange={(e) => setNameVi(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                />
              </label>

              <label className="grid gap-1 font-medium">
                English Name
                <input
                  required
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                />
              </label>

              <label className="grid gap-1 font-medium">
                Mô tả (VI)
                <input
                  value={descVi}
                  onChange={(e) => setDescVi(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                />
              </label>

              <label className="grid gap-1 font-medium">
                Description (EN)
                <input
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                />
              </label>

              <label className="grid gap-1 font-medium">
                Tiêu đề block mặc định
                <input
                  required
                  value={defaultTitle}
                  onChange={(e) => setDefaultTitle(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                />
              </label>

              <label className="grid gap-1 font-medium">
                Widget Kind
                <select
                  value={widgetKind}
                  onChange={(e) => setWidgetKind(e.target.value as BlockTemplate["widget_kind"])}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                >
                  <option value="METRIC_CARD">METRIC_CARD</option>
                  <option value="TASK_LIST">TASK_LIST</option>
                  <option value="CHART">CHART</option>
                  <option value="HEATMAP">HEATMAP</option>
                  <option value="PROGRESS">PROGRESS</option>
                </select>
              </label>

              <label className="grid gap-1 font-medium">
                Độ rộng mặc định (1–12)
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={defaultWidth}
                  onChange={(e) => setDefaultWidth(Number(e.target.value) || 6)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                />
              </label>

              <label className="grid gap-1 font-medium">
                Chiều cao mặc định (1–12 rows)
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={defaultHeight}
                  onChange={(e) => setDefaultHeight(Number(e.target.value) || 3)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5"
                />
              </label>
            </div>

            {/* Border & Surface Appearance Defaults */}
            <div className="space-y-3 border-t border-border pt-3">
              <p className="font-semibold text-foreground">
                {locale === "en" ? "Default Border & Card Appearance" : "Mặc định Viền & Giao diện Card"}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 font-medium">
                  Viền (Border Style)
                  <select
                    value={borderStyle}
                    onChange={(e) => setBorderStyle(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    {BORDER_OPTIONS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {locale === "en" ? b.en : b.vi}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 font-medium">
                  Độ dày viền (px)
                  <select
                    value={borderWidth}
                    onChange={(e) => setBorderWidth(Number(e.target.value))}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    <option value={1}>1px</option>
                    <option value={2}>2px</option>
                    <option value={3}>3px</option>
                  </select>
                </label>

                <label className="grid gap-1 font-medium">
                  Màu viền
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                    />
                    <input
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="h-9 flex-1 rounded-lg border border-input bg-background px-2 font-mono"
                    />
                  </div>
                </label>

                <label className="grid gap-1 font-medium">
                  Màu nền
                  <select
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
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
                  Bo góc
                  <select
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    <option value="none">Vuông</option>
                    <option value="md">Vừa</option>
                    <option value="2xl">Bo tròn</option>
                  </select>
                </label>

                <label className="grid gap-1 font-medium">
                  Khoảng đệm
                  <select
                    value={padding}
                    onChange={(e) => setPadding(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    <option value="sm">Gọn</option>
                    <option value="md">Vừa</option>
                    <option value="lg">Thoáng</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Structured Table Columns & Rows Editor (for FORM_TABLE templates) */}
            {(category === "FORM_TABLE" ||
              editing?.default_spec_json?.preset_type === "CUSTOM_TABLE") && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Cấu trúc Cột & Dòng mẫu (Form / Table)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const colId = `col_${Date.now().toString().slice(-4)}`;
                      setTableCols((prev) => [
                        ...prev,
                        { id: colId, label: `Cột ${prev.length + 1}`, type: "text" },
                      ]);
                    }}
                    className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"
                  >
                    + Thêm cột
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {tableCols.map((col, idx) => (
                    <div key={col.id} className="flex items-center gap-1.5">
                      <input
                        value={col.label}
                        onChange={(e) =>
                          setTableCols((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c))
                          )
                        }
                        className="h-8 flex-1 rounded border border-input bg-background px-2"
                      />
                      <select
                        value={col.type}
                        onChange={(e) =>
                          setTableCols((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, type: e.target.value as "text" | "number" } : c
                            )
                          )
                        }
                        className="h-8 rounded border border-input bg-background px-1.5"
                      >
                        <option value="text">Aa</option>
                        <option value="number">#</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setTableCols((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Hiển thị cho User</span>
                </label>

                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={isCustomizable}
                    onChange={(e) => setIsCustomizable(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Cho phép User tùy biến</span>
                </label>

                <button
                  type="button"
                  onClick={() => setRawJsonMode((p) => !p)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {rawJsonMode ? "Chế độ trực quan" : "Chỉnh JSON Spec nâng cao"}
                </button>
              </div>
            </div>

            {modalTab === "appearance" && rawJsonMode && (
              <textarea
                rows={6}
                value={rawSpecJson}
                onChange={(e) => setRawSpecJson(e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-3 font-mono text-[11px]"
              />
            )}

            {modalTab === "appearance" && <div className="hidden" />}
              </>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 rounded-lg border border-border px-3 font-medium hover:bg-secondary"
              >
                {locale === "en" ? "Cancel" : "Hủy"}
              </button>
              <button
                type="submit"
                disabled={saveMut.isPending}
                className="h-9 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
              >
                {saveMut.isPending ? "…" : locale === "en" ? "Save Template" : "Lưu mẫu"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
