"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FolderPlus,
  GripVertical,
  LayoutTemplate,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { PRESET_SIDEBAR_ICONS, SidebarItemIcon } from "@/components/layout/sidebar-icons";
import { createDashboard, deleteDashboard, patchDashboard } from "@/features/dashboards/api";
import { fetchCurrentUser, updateSettings, uploadUserFile } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarGroup, SidebarNavItem } from "@/types/domain";

const COUNTDOWN_ID = "system-countdown";
const DEFAULT_GROUP_ID = "default-group";

function buildDefaultCountdown(locale: "vi" | "en"): SidebarNavItem {
  return {
    id: COUNTDOWN_ID,
    title: locale === "en" ? "Countdown" : "Đếm ngược",
    href: "/time-tracking",
    icon_type: "preset",
    icon_value: "Timer",
    pinned: true,
    dashboard_id: null,
  };
}

function isCountdownItem(item: SidebarNavItem): boolean {
  return Boolean(item.pinned || item.id === COUNTDOWN_ID || item.href === "/time-tracking");
}

function normalizeGroups(
  rawGroups: unknown,
  rawLegacyItems: unknown,
  locale: "vi" | "en"
): SidebarGroup[] {
  const defaultGroupTitle = locale === "en" ? "Workspace" : "Không gian";
  let groups: SidebarGroup[] = [];

  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    groups = (rawGroups as SidebarGroup[])
      .filter((g) => g && typeof g.id === "string" && typeof g.title === "string")
      .map((g) => ({
        id: g.id,
        title: g.title,
        items: Array.isArray(g.items)
          ? g.items.filter((it) => it && typeof it.id === "string" && typeof it.href === "string")
          : [],
      }));
  } else if (Array.isArray(rawLegacyItems) && rawLegacyItems.length > 0) {
    const items = (rawLegacyItems as SidebarNavItem[]).filter(
      (it) => it && typeof it.id === "string" && typeof it.href === "string"
    );
    groups = [{ id: DEFAULT_GROUP_ID, title: defaultGroupTitle, items }];
  } else {
    groups = [
      {
        id: DEFAULT_GROUP_ID,
        title: defaultGroupTitle,
        items: [buildDefaultCountdown(locale)],
      },
    ];
  }

  if (groups.length === 0) {
    groups = [
      {
        id: DEFAULT_GROUP_ID,
        title: defaultGroupTitle,
        items: [buildDefaultCountdown(locale)],
      },
    ];
  }

  const hasCountdown = groups.some((g) => g.items.some(isCountdownItem));
  if (!hasCountdown) {
    groups[0] = {
      ...groups[0],
      items: [buildDefaultCountdown(locale), ...groups[0].items],
    };
  }
  return groups;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const { locale, t } = useI18n();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  const syncedTzRef = useRef(false);
  const [editMode, setEditMode] = useState(false);
  const [dragState, setDragState] = useState<{ groupId: string; index: number } | null>(null);
  const [dragGroupIdx, setDragGroupIdx] = useState<number | null>(null);

  // Page Add/Edit modal state (Blank Paper only — no template grid)
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<{ item: SidebarNavItem; groupId: string } | null>(
    null
  );
  const [pageTitle, setPageTitle] = useState("");
  const [pageGroupId, setPageGroupId] = useState(DEFAULT_GROUP_ID);
  const [iconTab, setIconTab] = useState<"preset" | "upload">("preset");
  const [pageIconValue, setPageIconValue] = useState("FileText");
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Group Add/Rename modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SidebarGroup | null>(null);
  const [groupTitleInput, setGroupTitleInput] = useState("");

  // Close open modals on Escape
  useEffect(() => {
    if (!pageModalOpen && !groupModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPageModalOpen(false);
        setGroupModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [groupModalOpen, pageModalOpen]);

  // Auto-sync device timezone invisibly since timezone setting was removed from UI
  useEffect(() => {
    const userTz = meQuery.data?.settings?.timezone;
    if (!userTz || syncedTzRef.current) return;
    syncedTzRef.current = true;
    try {
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (deviceTz && deviceTz !== userTz) {
        void updateSettings({ timezone: deviceTz }).then(() => {
          void client.invalidateQueries({ queryKey: ["me"] });
        });
      }
    } catch {
      // Keep server timezone if browser does not expose IANA zone
    }
  }, [client, meQuery.data?.settings?.timezone]);

  const rawGroups = meQuery.data?.settings?.preferences_json?.sidebar_groups;
  const rawLegacyItems = meQuery.data?.settings?.preferences_json?.sidebar_items;

  const sidebarGroups: SidebarGroup[] = useMemo(
    () => normalizeGroups(rawGroups, rawLegacyItems, locale),
    [locale, rawGroups, rawLegacyItems]
  );

  const persistGroupsMut = useMutation({
    mutationFn: (nextGroups: SidebarGroup[]) =>
      updateSettings({
        preferences_json: {
          sidebar_groups: nextGroups,
          sidebar_items: nextGroups.flatMap((g) => g.items),
        },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save sidebar"),
  });

  const savePageModalMut = useMutation({
    mutationFn: async () => {
      const cleanTitle = pageTitle.trim();
      if (!cleanTitle) throw new Error("Empty title");
      const targetGroupId = sidebarGroups.some((g) => g.id === pageGroupId)
        ? pageGroupId
        : sidebarGroups[0].id;

      if (editingPage) {
        const updatedItem: SidebarNavItem = {
          ...editingPage.item,
          title: cleanTitle,
          icon_type: iconTab,
          icon_value: pageIconValue || "FileText",
        };
        if (editingPage.item.dashboard_id) {
          await patchDashboard(editingPage.item.dashboard_id, { title: cleanTitle });
        }
        const nextGroups = sidebarGroups.map((g) => {
          if (g.id === editingPage.groupId && g.id === targetGroupId) {
            return {
              ...g,
              items: g.items.map((it) => (it.id === updatedItem.id ? updatedItem : it)),
            };
          }
          if (g.id === editingPage.groupId) {
            return { ...g, items: g.items.filter((it) => it.id !== updatedItem.id) };
          }
          if (g.id === targetGroupId) {
            return { ...g, items: [...g.items, updatedItem] };
          }
          return g;
        });
        await persistGroupsMut.mutateAsync(nextGroups);
        return { navigateTo: null as string | null };
      }

      // Create pure Blank Paper page (no initial template blocks)
      const dash = await createDashboard({ title: cleanTitle });
      const newItem: SidebarNavItem = {
        id: `page-${dash.id}`,
        title: cleanTitle,
        href: `/pages/${dash.id}`,
        icon_type: iconTab,
        icon_value: pageIconValue || "FileText",
        pinned: false,
        dashboard_id: dash.id,
      };
      const nextGroups = sidebarGroups.map((g) =>
        g.id === targetGroupId ? { ...g, items: [...g.items, newItem] } : g
      );
      await persistGroupsMut.mutateAsync(nextGroups);
      return { navigateTo: `/pages/${dash.id}` };
    },
    onSuccess: async ({ navigateTo }) => {
      setPageModalOpen(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["me"] }),
        client.invalidateQueries({ queryKey: ["dashboards-list"] }),
      ]);
      if (navigateTo) {
        router.push(navigateTo);
      }
      toast.success(
        editingPage
          ? locale === "en"
            ? "Updated page"
            : "Đã cập nhật trang"
          : locale === "en"
            ? "Created page"
            : "Đã tạo trang mới"
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  function moveGroup(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= sidebarGroups.length || fromIdx === toIdx) return;
    const next = [...sidebarGroups];
    const [picked] = next.splice(fromIdx, 1);
    if (!picked) return;
    next.splice(toIdx, 0, picked);
    persistGroupsMut.mutate(next);
  }

  function saveGroupModal(e: FormEvent) {
    e.preventDefault();
    const clean = groupTitleInput.trim();
    if (!clean) return;
    if (editingGroup) {
      const next = sidebarGroups.map((g) =>
        g.id === editingGroup.id ? { ...g, title: clean } : g
      );
      persistGroupsMut.mutate(next);
    } else {
      const next = [
        ...sidebarGroups,
        { id: `group-${Date.now()}`, title: clean, items: [] },
      ];
      persistGroupsMut.mutate(next);
    }
    setGroupModalOpen(false);
  }

  async function removeGroup(group: SidebarGroup) {
    if (sidebarGroups.length <= 1 || group.items.some(isCountdownItem)) {
      return;
    }
    for (const it of group.items) {
      if (it.dashboard_id) {
        try {
          await deleteDashboard(it.dashboard_id);
        } catch {
          // Ignore if already removed
        }
      }
    }
    const next = sidebarGroups.filter((g) => g.id !== group.id);
    await persistGroupsMut.mutateAsync(next);
    if (group.items.some((it) => pathname === it.href)) {
      router.replace("/time-tracking");
    }
  }

  function moveItemBetweenGroups(
    sourceGroupId: string,
    fromIdx: number,
    targetGroupId: string,
    toIdx?: number
  ) {
    if (sourceGroupId === targetGroupId) {
      if (toIdx !== undefined) moveItemInGroup(sourceGroupId, fromIdx, toIdx);
      return;
    }
    const srcGrp = sidebarGroups.find((g) => g.id === sourceGroupId);
    const dstGrp = sidebarGroups.find((g) => g.id === targetGroupId);
    if (!srcGrp || !dstGrp) return;
    const picked = srcGrp.items[fromIdx];
    if (!picked) return;

    const next = sidebarGroups.map((g) => {
      if (g.id === sourceGroupId) {
        return { ...g, items: g.items.filter((_, idx) => idx !== fromIdx) };
      }
      if (g.id === targetGroupId) {
        const items = [...g.items];
        const insertAt = toIdx !== undefined ? Math.max(0, Math.min(items.length, toIdx)) : items.length;
        items.splice(insertAt, 0, picked);
        return { ...g, items };
      }
      return g;
    });
    persistGroupsMut.mutate(next);
  }

  function moveItemInGroup(groupId: string, fromIdx: number, toIdx: number) {
    const grp = sidebarGroups.find((g) => g.id === groupId);
    if (!grp || toIdx < 0 || toIdx >= grp.items.length || fromIdx === toIdx) return;
    const items = [...grp.items];
    const [picked] = items.splice(fromIdx, 1);
    if (!picked) return;
    items.splice(toIdx, 0, picked);
    const next = sidebarGroups.map((g) => (g.id === groupId ? { ...g, items } : g));
    persistGroupsMut.mutate(next);
  }

  async function removeItem(groupId: string, item: SidebarNavItem) {
    if (isCountdownItem(item)) return;
    const next = sidebarGroups.map((g) =>
      g.id === groupId ? { ...g, items: g.items.filter((x) => x.id !== item.id) } : g
    );
    if (item.dashboard_id) {
      try {
        await deleteDashboard(item.dashboard_id);
      } catch {
        // Ignore if already deleted
      }
    }
    await persistGroupsMut.mutateAsync(next);
    if (pathname === item.href) {
      router.replace("/time-tracking");
    }
  }

  async function handleIconUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingIcon(true);
    try {
      const uploaded = await uploadUserFile(file, "avatars");
      setIconTab("upload");
      setPageIconValue(uploaded.stream_url);
      toast.success(locale === "en" ? "Icon uploaded" : "Đã tải ảnh icon lên");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingIcon(false);
    }
  }

  function openCreatePageModal(groupId?: string) {
    setEditingPage(null);
    setPageTitle("");
    setPageGroupId(groupId ?? sidebarGroups[0]?.id ?? DEFAULT_GROUP_ID);
    setIconTab("preset");
    setPageIconValue("FileText");
    setPageModalOpen(true);
  }

  function openEditPageModal(item: SidebarNavItem, groupId: string) {
    setEditingPage({ item, groupId });
    setPageTitle(item.title);
    setPageGroupId(groupId);
    setIconTab(item.icon_type);
    setPageIconValue(item.icon_value);
    setPageModalOpen(true);
  }

  function openCreateGroupModal() {
    setEditingGroup(null);
    setGroupTitleInput("");
    setGroupModalOpen(true);
  }

  function openRenameGroupModal(group: SidebarGroup) {
    setEditingGroup(group);
    setGroupTitleInput(group.title);
    setGroupModalOpen(true);
  }

  function handlePageModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pageTitle.trim() || savePageModalMut.isPending) return;
    savePageModalMut.mutate();
  }

  return (
    <>
      <aside
        className={cn(
          "hidden h-full shrink-0 overflow-hidden md:flex flex-col border-r border-border bg-card transition-[width] duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Fixed Header of Sidebar */}
        <div
          className={cn(
            "flex shrink-0 items-center px-4 pt-3.5 pb-2",
            collapsed ? "justify-center px-3" : "justify-between"
          )}
        >
          {!collapsed && (
            <Link href="/time-tracking" aria-label="LumiPlan Home" className="flex items-center">
              <BrandLogo variant="full" />
            </Link>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Independent Scrollable Multi-Group Pages List */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-2">
          {!collapsed && (
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "en" ? "Workspace" : "Danh mục"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={openCreateGroupModal}
                  title={locale === "en" ? "New section" : "Thêm mục mới"}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openCreatePageModal()}
                  title={locale === "en" ? "Add page" : "Thêm trang"}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode((p) => !p)}
                  title={locale === "en" ? "Edit sidebar" : "Chỉnh sửa sidebar"}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                    editMode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {editMode
                    ? locale === "en"
                      ? "Done"
                      : "Xong"
                    : locale === "en"
                      ? "Edit"
                      : "Sửa"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {sidebarGroups.map((group, gIdx) => {
              const groupContainsCountdown = group.items.some(isCountdownItem);
              const canDeleteGroup = sidebarGroups.length > 1 && !groupContainsCountdown;

              return (
                <section
                  key={group.id}
                  onDragOver={(e) => {
                    if (editMode) e.preventDefault();
                  }}
                  onDrop={() => {
                    if (dragGroupIdx !== null && dragGroupIdx !== gIdx) {
                      moveGroup(dragGroupIdx, gIdx);
                      setDragGroupIdx(null);
                      return;
                    }
                    if (dragState && dragState.groupId !== group.id) {
                      moveItemBetweenGroups(dragState.groupId, dragState.index, group.id);
                      setDragState(null);
                    }
                  }}
                  className={cn(
                    "space-y-1 rounded-lg transition-colors",
                    editMode && dragGroupIdx === gIdx && "opacity-60 ring-1 ring-primary"
                  )}
                >
                  {!collapsed && (
                    <div
                      draggable={editMode}
                      onDragStart={() => {
                        setDragState(null);
                        setDragGroupIdx(gIdx);
                      }}
                      onDragEnd={() => setDragGroupIdx(null)}
                      className={cn(
                        "flex items-center justify-between gap-1 px-2 pt-1",
                        editMode && "cursor-grab rounded hover:bg-secondary/60"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {editMode && <GripVertical className="h-3 w-3 shrink-0 opacity-70" />}
                        <span className="truncate">{group.title}</span>
                      </span>
                      {editMode ? (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            disabled={gIdx === 0}
                            onClick={() => moveGroup(gIdx, gIdx - 1)}
                            aria-label="Move section up"
                            className="rounded p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={gIdx === sidebarGroups.length - 1}
                            onClick={() => moveGroup(gIdx, gIdx + 1)}
                            aria-label="Move section down"
                            className="rounded p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openRenameGroupModal(group)}
                            aria-label="Rename section"
                            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          {canDeleteGroup ? (
                            <button
                              type="button"
                              onClick={() => void removeGroup(group)}
                              aria-label="Delete section"
                              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : groupContainsCountdown ? (
                            <span
                              title={
                                locale === "en"
                                  ? "Contains locked Countdown page"
                                  : "Mục đang chứa Đếm ngược"
                              }
                              className="p-0.5 text-muted-foreground/50"
                            >
                              <Lock className="h-3 w-3" />
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCreatePageModal(group.id)}
                          title={locale === "en" ? "Add page to section" : "Thêm trang vào mục"}
                          className="rounded p-0.5 text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <nav aria-label={group.title} className="space-y-0.5">
                    {group.items.map((item, idx) => {
                      const isLocked = isCountdownItem(item);
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const displayTitle =
                        item.id === COUNTDOWN_ID && item.title === "Đếm ngược" && locale === "en"
                          ? "Countdown"
                          : item.id === COUNTDOWN_ID && item.title === "Countdown" && locale === "vi"
                            ? "Đếm ngược"
                            : item.title;

                      if (editMode && !collapsed) {
                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setDragGroupIdx(null);
                              setDragState({ groupId: group.id, index: idx });
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.stopPropagation();
                              if (dragState) {
                                moveItemBetweenGroups(dragState.groupId, dragState.index, group.id, idx);
                              }
                              setDragState(null);
                            }}
                            className={cn(
                              "flex items-center justify-between gap-1 rounded-lg border border-border/70 bg-background/60 px-2 py-1.5 text-xs",
                              dragState?.groupId === group.id &&
                                dragState.index === idx &&
                                "border-primary opacity-60"
                            )}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                              <SidebarItemIcon
                                iconType={item.icon_type}
                                iconValue={item.icon_value}
                              />
                              <span className="truncate font-medium text-foreground">
                                {displayTitle}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveItemInGroup(group.id, idx, idx - 1)}
                                aria-label="Move up"
                                className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === group.items.length - 1}
                                onClick={() => moveItemInGroup(group.id, idx, idx + 1)}
                                aria-label="Move down"
                                className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditPageModal(item, group.id)}
                                aria-label="Edit page"
                                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              {isLocked ? (
                                <span
                                  title={
                                    locale === "en"
                                      ? "Default page (cannot be deleted)"
                                      : "Mục mặc định (không thể xóa)"
                                  }
                                  className="p-1 text-muted-foreground/60"
                                >
                                  <Lock className="h-3 w-3" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void removeItem(group.id, item)}
                                  aria-label="Delete page"
                                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          title={displayTitle}
                          aria-label={displayTitle}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                            collapsed && "justify-center px-2",
                            active
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          <SidebarItemIcon iconType={item.icon_type} iconValue={item.icon_value} />
                          {!collapsed && <span className="truncate">{displayTitle}</span>}
                        </Link>
                      );
                    })}
                  </nav>
                </section>
              );
            })}
          </div>

          {meQuery.data?.role === "ADMIN" && (
            <>
              <div className="my-4 border-t border-border" />
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.nav.admin}
                </p>
              )}
              <nav aria-label="Admin navigation" className="space-y-0.5">
                <Link
                  href="/admin/users"
                  title={t.nav.users}
                  aria-label={t.nav.users}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                    collapsed && "justify-center px-2",
                    pathname.startsWith("/admin/users")
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{t.nav.users}</span>}
                </Link>
                <Link
                  href="/admin/templates"
                  title={locale === "en" ? "Form & Card Templates" : "Form & Card mẫu"}
                  aria-label={locale === "en" ? "Form & Card Templates" : "Form & Card mẫu"}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                    collapsed && "justify-center px-2",
                    pathname.startsWith("/admin/templates")
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && (
                    <span className="truncate">
                      {locale === "en" ? "Templates" : "Form & Card mẫu"}
                    </span>
                  )}
                </Link>
              </nav>
            </>
          )}
        </div>
      </aside>

      {/* Add / Edit Sidebar Page Modal (Blank Paper default, closes on outside click & Escape) */}
      {pageModalOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPageModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handlePageModalSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-semibold text-foreground">
                {editingPage
                  ? locale === "en"
                    ? "Edit Page"
                    : "Chỉnh sửa trang"
                  : locale === "en"
                    ? "Create New Page"
                    : "Thêm trang mới vào Sidebar"}
              </h2>
              <button type="button" onClick={() => setPageModalOpen(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                {locale === "en" ? "Page Name" : "Tên trang"}
                <input
                  required
                  autoFocus
                  maxLength={80}
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder={locale === "en" ? "e.g. Weekly Plan" : "Ví dụ: Kế hoạch tuần"}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-foreground">
                {locale === "en" ? "Section" : "Thuộc mục"}
                <select
                  value={pageGroupId}
                  onChange={(e) => setPageGroupId(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  {sidebarGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Icon Selector: Built-in Preset Set OR System File Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Icon</span>
                <div className="flex rounded-lg border border-border bg-background p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIconTab("preset")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      iconTab === "preset" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {locale === "en" ? "Preset Icons" : "Bộ có sẵn"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconTab("upload")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      iconTab === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {locale === "en" ? "Upload Image" : "Tải ảnh lên"}
                  </button>
                </div>
              </div>

              {iconTab === "preset" ? (
                <div className="grid grid-cols-8 gap-1.5 rounded-xl border border-border bg-background/50 p-2.5">
                  {PRESET_SIDEBAR_ICONS.map(({ key, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setIconTab("preset");
                        setPageIconValue(key);
                      }}
                      title={key}
                      className={cn(
                        "flex h-9 w-full items-center justify-center rounded-lg border transition-colors",
                        iconTab === "preset" && pageIconValue === key
                          ? "border-primary bg-accent text-primary"
                          : "border-transparent hover:bg-secondary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background/50 p-4">
                  {pageIconValue.startsWith("/") || pageIconValue.startsWith("http") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={pageIconValue}
                      alt="Custom icon"
                      className="h-10 w-10 rounded-lg border border-border object-cover"
                    />
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary">
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {uploadingIcon
                        ? t.common.loading
                        : locale === "en"
                          ? "Choose image from device"
                          : "Chọn ảnh từ máy"}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleIconUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setPageModalOpen(false)}
                className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={!pageTitle.trim() || savePageModalMut.isPending || uploadingIcon}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{t.common.save}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Rename Section Modal */}
      {groupModalOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setGroupModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={saveGroupModal}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-semibold text-foreground">
                {editingGroup
                  ? locale === "en"
                    ? "Rename Section"
                    : "Đổi tên mục"
                  : locale === "en"
                    ? "New Section"
                    : "Thêm mục Sidebar"}
              </h2>
              <button type="button" onClick={() => setGroupModalOpen(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <label className="grid gap-1.5 text-xs font-medium text-foreground">
              {locale === "en" ? "Section Name" : "Tên mục"}
              <input
                required
                autoFocus
                maxLength={60}
                value={groupTitleInput}
                onChange={(e) => setGroupTitleInput(e.target.value)}
                placeholder={locale === "en" ? "e.g. Work, Personal" : "Ví dụ: Công việc, Cá nhân"}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={!groupTitleInput.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{t.common.save}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
