"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import type { SidebarGroup, SidebarNavItem } from "@/types/domain";

export function DocumentTitleSync() {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  const rawGroups = meQuery.data?.settings?.preferences_json?.sidebar_groups;
  const rawItems = meQuery.data?.settings?.preferences_json?.sidebar_items;

  useEffect(() => {
    const flattenedGroupItems: SidebarNavItem[] = Array.isArray(rawGroups)
      ? (rawGroups as SidebarGroup[]).flatMap((g) => (Array.isArray(g?.items) ? g.items : []))
      : [];
    const fallbackItems: SidebarNavItem[] = Array.isArray(rawItems)
      ? (rawItems as SidebarNavItem[])
      : [];
    const customItems = flattenedGroupItems.length > 0 ? flattenedGroupItems : fallbackItems;

    if (pathname.startsWith("/pages/") && customItems.length > 0) {
      const matchedCustom = customItems.find((item) => pathname === item.href);
      if (matchedCustom) {
        document.title = `LumiPlan | ${matchedCustom.title}`;
        return;
      }
    }

    const routeTitles: Array<[string, string]> = [
      ["/dashboard", t.nav.dashboard],
      ["/today", t.nav.today],
      ["/todo-list", t.nav.todoList],
      ["/tasks", t.nav.tasks],
      ["/planning", t.nav.planning],
      ["/calendar", t.nav.calendar],
      ["/time-tracking", t.nav.focus],
      ["/projects", t.nav.projects],
      ["/goals", t.nav.goals],
      ["/analytics", t.nav.analytics],
      ["/settings", t.nav.settings],
      ["/admin/users", t.nav.users],
      ["/login", locale === "en" ? "Sign in" : "Đăng nhập"],
      ["/register", locale === "en" ? "Sign up" : "Đăng ký"],
      ["/policy", locale === "en" ? "Policy" : "Chính sách"],
    ];

    const matched = routeTitles.find(([prefix]) => pathname.startsWith(prefix));
    document.title = matched ? `LumiPlan | ${matched[1]}` : "LumiPlan";
  }, [locale, pathname, rawGroups, rawItems, t.nav]);

  return null;
}
