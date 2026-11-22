"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { AuthGuard } from "@/components/layout/auth-guard";
import { BrandLogo } from "@/components/layout/brand-logo";
import { CommandMenu } from "@/components/layout/command-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";
import { AIChatWidget } from "@/features/ai/ai-chat-widget";
import { FocusTimerPill } from "@/features/time-tracking/focus-timer-pill";
import { useUiStore } from "@/stores/ui-store";

export function AppShell({ children }: { children: ReactNode }) {
  const setCommandMenuOpen = useUiStore((s) => s.setCommandMenuOpen);

  return (
    <AuthGuard>
      <div className="flex h-dvh overflow-hidden bg-background text-foreground">
        <Sidebar />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-10">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <BrandLogo variant="compact" />
              </div>
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
            </div>

            <div className="flex items-center gap-2">
              <FocusTimerPill />
              <LanguageSwitcher />
              <ThemeSwitcher />
              <UserAvatarMenu />
            </div>
          </header>

          <main
            id="workspace-main-scroll"
            className="relative z-10 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-24 md:px-10 md:py-7"
          >
            {children}
          </main>
        </div>

        <MobileNav />
        <CommandMenu />
        <AIChatWidget />
      </div>
    </AuthGuard>
  );
}
