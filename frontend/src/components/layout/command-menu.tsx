"use client";

import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { FileText, LayoutTemplate, Search, Settings, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { SidebarItemIcon } from "@/components/layout/sidebar-icons";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarGroup, SidebarNavItem } from "@/types/domain";

export function CommandMenu() {
  const open = useUiStore((s) => s.commandMenuOpen);
  const setOpen = useUiStore((s) => s.setCommandMenuOpen);
  const router = useRouter();
  const { locale, t } = useI18n();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
      if (event.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const rawGroups = meQuery.data?.settings?.preferences_json?.sidebar_groups;
  const rawLegacyItems = meQuery.data?.settings?.preferences_json?.sidebar_items;

  const groups: SidebarGroup[] = useMemo(() => {
    const defaultCountdown: SidebarNavItem = {
      id: "system-countdown",
      title: locale === "en" ? "Countdown" : "Đếm ngược",
      href: "/time-tracking",
      icon_type: "preset",
      icon_value: "Timer",
      pinned: true,
    };
    const defaultTitle = locale === "en" ? "Workspace" : "Không gian";
    if (Array.isArray(rawGroups) && rawGroups.length > 0) {
      return (rawGroups as SidebarGroup[]).filter(
        (g) => g && typeof g.id === "string" && Array.isArray(g.items)
      );
    }
    if (Array.isArray(rawLegacyItems) && rawLegacyItems.length > 0) {
      return [
        {
          id: "default-group",
          title: defaultTitle,
          items: rawLegacyItems as SidebarNavItem[],
        },
      ];
    }
    return [{ id: "default-group", title: defaultTitle, items: [defaultCountdown] }];
  }, [locale, rawGroups, rawLegacyItems]);

  const totalPages = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (!open) return null;

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-4 pt-20 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Quick Jump"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <Command label="Quick Jump Pages">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder={
                locale === "en"
                  ? `Search ${totalPages} pages or settings...`
                  : `Tìm kiếm nhanh trong ${totalPages} trang đang có...`
              }
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto overscroll-contain p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              {locale === "en"
                ? "No matching page found."
                : "Không tìm thấy trang phù hợp."}
            </Command.Empty>

            {groups.map((group) =>
              group.items.length > 0 ? (
                <Command.Group
                  key={group.id}
                  heading={group.title}
                  className="px-1 py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.title} ${group.title} ${item.href}`}
                      onSelect={() => navigate(item.href)}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-normal text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <SidebarItemIcon
                          iconType={item.icon_type}
                          iconValue={item.icon_value}
                        />
                        <span className="truncate font-medium">{item.title}</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {group.title}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null
            )}

            <Command.Group
              heading={locale === "en" ? "System" : "Hệ thống"}
              className="mt-1 border-t border-border/60 px-1 pt-2 text-[11px] font-semibold text-muted-foreground"
            >
              <Command.Item
                value={`settings cài đặt ${t.nav.settings}`}
                onSelect={() => navigate("/settings")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-normal text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Settings className="h-4 w-4 text-primary" />
                <span>{t.nav.settings}</span>
              </Command.Item>

              {meQuery.data?.role === "ADMIN" && (
                <>
                  <Command.Item
                    value={`admin users tài khoản ${t.nav.users}`}
                    onSelect={() => navigate("/admin/users")}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-normal text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Shield className="h-4 w-4 text-primary" />
                    <span>{t.nav.users}</span>
                  </Command.Item>
                  <Command.Item
                    value="admin block templates form mẫu card"
                    onSelect={() => navigate("/admin/templates")}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-normal text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <LayoutTemplate className="h-4 w-4 text-primary" />
                    <span>
                      {locale === "en" ? "Form & Card Templates" : "Quản lý Form & Card mẫu"}
                    </span>
                  </Command.Item>
                </>
              )}

              <Command.Item
                value="countdown đếm ngược focus timer"
                onSelect={() => navigate("/time-tracking")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-normal text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{locale === "en" ? "Open Countdown" : "Mở Đếm ngược"}</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
