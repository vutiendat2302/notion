"use client";

import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { fetchCurrentUser, updateSettings } from "@/features/users/api";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Hệ thống", icon: Monitor },
] as const;

const emptySubscribe = () => () => {};

function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const storedTheme = user.data?.settings?.theme;

  useEffect(() => {
    if (storedTheme) {
      setTheme(storedTheme.toLowerCase());
    }
  }, [storedTheme, setTheme]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const save = useMutation({
    mutationFn: (value: "LIGHT" | "DARK" | "SYSTEM") => updateSettings({ theme: value }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Không lưu được giao diện."),
  });

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 rounded-lg border border-border bg-secondary/50",
          compact ? "w-14" : "w-32"
        )}
      />
    );
  }

  const currentOption = OPTIONS.find((opt) => opt.value === theme) ?? OPTIONS[2];
  const CurrentIcon = currentOption.icon;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={save.isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Giao diện: ${currentOption.label}`}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary",
          open && "border-primary/60 bg-secondary"
        )}
      >
        <CurrentIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {!compact && <span>{currentOption.label}</span>}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Chọn giao diện"
          className="absolute right-0 z-50 mt-1.5 w-36 origin-top-right rounded-xl border border-border bg-popover p-1 shadow-md"
        >
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = currentOption.value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(opt.value);
                  setOpen(false);
                  if (user.data) {
                    save.mutate(opt.value.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM");
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{opt.label}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
