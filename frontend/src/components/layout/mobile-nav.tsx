"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { fetchCurrentUser } from "@/features/users/api";
import { cn } from "@/lib/utils";

const MOBILE_TABS = [
  { href: "/dashboard", label: "Home" },
  { href: "/today", label: "Today" },
  { href: "/todo-list", label: "Todo" },
  { href: "/time-tracking", label: "Focus" },
];

const BASE_MORE_TABS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/planning", label: "Plan" },
  { href: "/calendar", label: "Calendar" },
  { href: "/projects", label: "Projects" },
  { href: "/goals", label: "Goals" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });

  useEffect(() => {
    if (!moreOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const moreTabs =
    meQuery.data?.role === "ADMIN"
      ? [...BASE_MORE_TABS, { href: "/admin/users", label: "Users (Admin)" }]
      : BASE_MORE_TABS;

  return (
    <nav
      ref={navRef}
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden"
    >
      {moreOpen && (
        <div
          id="mobile-more-menu"
          className="absolute right-2 bottom-full mb-2 w-48 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          {moreTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "block min-h-10 rounded-lg px-3 py-2.5 text-sm",
                pathname.startsWith(tab.href)
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}
      {MOBILE_TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-h-11 min-w-16 items-center justify-center rounded-lg px-3 text-xs font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="More navigation"
        aria-expanded={moreOpen}
        aria-controls="mobile-more-menu"
        onClick={() => setMoreOpen((value) => !value)}
        className={cn(
          "min-h-11 min-w-16 rounded-lg px-3 text-xs font-medium",
          moreTabs.some((tab) => pathname.startsWith(tab.href))
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground"
        )}
      >
        More
      </button>
    </nav>
  );
}
