"use client";

import { Command } from "cmdk";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useUiStore } from "@/stores/ui-store";

const NAV_COMMANDS = [
  { label: "Go to Today", href: "/today", shortcut: "G T" },
  { label: "Go to Tasks & Inbox", href: "/tasks", shortcut: "G K" },
  { label: "Go to Planning (Year -> Day)", href: "/planning", shortcut: "G P" },
  { label: "Go to Calendar & Timeline", href: "/calendar", shortcut: "G C" },
  { label: "Go to Goals", href: "/goals", shortcut: "G G" },
  { label: "Go to Analytics", href: "/analytics", shortcut: "G A" },
  { label: "Go to Settings", href: "/settings", shortcut: "G S" },
];

export function CommandMenu() {
  const open = useUiStore((s) => s.commandMenuOpen);
  const setOpen = useUiStore((s) => s.setCommandMenuOpen);
  const router = useRouter();
  const { setTheme } = useTheme();

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

  if (!open) return null;

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24 px-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global Command Menu">
          <div className="border-b border-border px-4 py-3">
            <Command.Input
              autoFocus
              placeholder="Jump to view, switch theme..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matching command.
            </Command.Empty>

            <Command.Group
              heading="Navigation"
              className="px-2 py-1 text-xs font-medium text-muted-foreground"
            >
              {NAV_COMMANDS.map((item) => (
                <Command.Item
                  key={item.href}
                  onSelect={() => navigate(item.href)}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <span>{item.label}</span>
                  <kbd className="font-mono text-xs text-muted-foreground">
                    {item.shortcut}
                  </kbd>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Appearance"
              className="mt-2 px-2 py-1 text-xs font-medium text-muted-foreground"
            >
              <Command.Item
                onSelect={() => {
                  setTheme("light");
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                Switch to Light Theme
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setTheme("dark");
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                Switch to Dark Theme (Slate Blue)
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
