"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, PanelLeftClose, PanelLeftOpen, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { fetchCurrentUser, logoutAccount } from "@/features/users/api";
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
  const router = useRouter();
  const client = useQueryClient();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutAccount,
    onSuccess: () => {
      client.clear();
      toast.success("Đã đăng xuất.");
      router.replace("/login");
      router.refresh();
    },
    onError: () => {
      client.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  const currentUser = meQuery.data;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col justify-between border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="p-3">
        <div
          className={cn(
            "mb-6 flex items-center px-1 py-1",
            collapsed ? "flex-col gap-2" : "justify-between"
          )}
        >
          <Link href="/today" aria-label="Trang chủ Today" className="flex items-center">
            <BrandLogo variant={collapsed ? "compact" : "full"} />
          </Link>
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
                  <span className="mx-auto text-xs font-semibold">{item.short}</span>
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
                  <span className="mx-auto text-xs font-semibold">{item.short}</span>
                ) : (
                  <span>{item.label}</span>
                )}
              </Link>
            );
          })}

          {currentUser?.role === "ADMIN" && (
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                pathname.startsWith("/admin/users")
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {collapsed ? (
                <Shield className="mx-auto h-4 w-4" aria-label="Users Admin" />
              ) : (
                <>
                  <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Users</span>
                </>
              )}
            </Link>
          )}
        </nav>
      </div>

      <div className="border-t border-border p-3">
        {!collapsed && currentUser && (
          <div className="mb-2 rounded-lg bg-secondary/70 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-foreground">
                {currentUser.display_name}
              </p>
              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                {currentUser.role}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {currentUser.username ? `@${currentUser.username}` : currentUser.email ?? currentUser.phone}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          aria-label="Đăng xuất"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-50",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>{logoutMutation.isPending ? "Đang thoát…" : "Đăng xuất"}</span>}
        </button>
      </div>
    </aside>
  );
}
