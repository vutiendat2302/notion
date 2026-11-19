"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { CommandMenu } from "@/components/layout/command-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { FocusTimerPill } from "@/features/time-tracking/focus-timer-pill";
import { useUiStore } from "@/stores/ui-store";

export function AppShell({ children }: { children: ReactNode }) {
  const setCommandMenuOpen = useUiStore((s) => s.setCommandMenuOpen);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            onClick={() => setCommandMenuOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Quick jump</span>
            <kbd className="hidden rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              Ctrl K
            </kbd>
          </button>

          <div className="flex items-center gap-3">
            <FocusTimerPill />
            <div className="hidden sm:block">
              <ThemeSwitcher compact />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      <MobileNav />
      <CommandMenu />
    </div>
  );
}
