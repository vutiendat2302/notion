"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { fetchCurrentUser, updateSettings } from "@/features/users/api";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
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
  const client = useQueryClient();
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const storedTheme = user.data?.settings?.theme;
  useEffect(() => { if (storedTheme) setTheme(storedTheme.toLowerCase()); }, [storedTheme, setTheme]);
  const save = useMutation({
    mutationFn: (value: "LIGHT" | "DARK" | "SYSTEM") => updateSettings({ theme: value }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["me"] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không lưu được theme."),
  });

  if (!mounted) {
    return (
      <div className="h-9 w-full rounded-lg border border-border bg-secondary/50" />
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setTheme(opt.value); if (user.data) save.mutate(opt.value.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM"); }}
            disabled={save.isPending}
            aria-label={`Switch to ${opt.label} theme`}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {!compact && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
