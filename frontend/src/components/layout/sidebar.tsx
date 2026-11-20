"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

const PRIMARY_NAV = [
  { href: "/today", label: "Today", short: "Td" },
  { href: "/tasks", label: "Tasks", short: "Tk" },
  { href: "/planning", label: "Planning", short: "Pl" },
  { href: "/projects", label: "Projects", short: "Pr" },
  { href: "/calendar", label: "Calendar", short: "Ca" },
  { href: "/analytics", label: "Analytics", short: "An" },
];

const SECONDARY_NAV = [
  { href: "/goals", label: "Goals", short: "Gl" },
  { href: "/settings", label: "Settings", short: "St" },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col justify-between border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="p-3">
        <div className="mb-6 flex items-center justify-between px-2 py-1">
          {!collapsed && (
            <Link
              href="/today"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              Productivity OS
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

        <nav aria-label="Workspace navigation" className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {collapsed ? (
                  <span className="mx-auto text-xs font-semibold">
                    {item.short}
                  </span>
                ) : (
                  <span>{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="my-4 border-t border-border" />

        <nav aria-label="Secondary navigation" className="space-y-1">
          {SECONDARY_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {collapsed ? (
                  <span className="mx-auto text-xs font-semibold">
                    {item.short}
                  </span>
                ) : (
                  <span>{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {!collapsed && (
        <div className="border-t border-border p-3">
          <Link
            href="/login"
            className="block rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Account / Sign in
          </Link>
        </div>
      )}
    </aside>
  );
}
