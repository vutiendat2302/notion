"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

const MOBILE_TABS = [
  { href: "/today", label: "Today" },
  { href: "/tasks", label: "Tasks" },
  { href: "/calendar", label: "Calendar" },
  { href: "/planning", label: "Plan" },
];

const MORE_TABS = [
  { href: "/projects", label: "Projects" },
  { href: "/goals", label: "Goals" },
  { href: "/time-tracking", label: "Focus" },
  { href: "/settings", label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden"
    >
      {moreOpen && <div id="mobile-more-menu" className="absolute bottom-full right-2 mb-2 w-44 rounded-xl border border-border bg-card p-2 shadow-lg">
        {MORE_TABS.map((tab) => <Link key={tab.href} href={tab.href} onClick={() => setMoreOpen(false)} className={cn("block min-h-10 rounded-lg px-3 py-2.5 text-sm", pathname.startsWith(tab.href) ? "bg-accent font-medium" : "text-muted-foreground hover:bg-secondary")}>{tab.label}</Link>)}
      </div>}
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
      <button type="button" aria-label="More navigation" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((value) => !value)} className={cn("min-h-11 min-w-16 rounded-lg px-3 text-xs font-medium", MORE_TABS.some((tab) => pathname.startsWith(tab.href)) ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>More</button>
    </nav>
  );
}
