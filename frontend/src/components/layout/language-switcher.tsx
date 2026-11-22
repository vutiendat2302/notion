"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchCurrentUser, updateSettings } from "@/features/users/api";
import type { Locale } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

function VietnamFlag() {
  return (
    <svg viewBox="0 0 24 18" className="h-4 w-5 rounded-[2px] shadow-2xs" aria-hidden="true">
      <rect width="24" height="18" fill="#DA251D" />
      <polygon
        points="12,3.4 13.4,7.8 18,7.8 14.3,10.5 15.7,14.8 12,12.1 8.3,14.8 9.7,10.5 6,7.8 10.6,7.8"
        fill="#FFFF00"
      />
    </svg>
  );
}

function UsFlag() {
  return (
    <svg viewBox="0 0 24 18" className="h-4 w-5 rounded-[2px] shadow-2xs" aria-hidden="true">
      <rect width="24" height="18" fill="#FFFFFF" />
      <rect y="0" width="24" height="2.6" fill="#B22234" />
      <rect y="5.2" width="24" height="2.6" fill="#B22234" />
      <rect y="10.4" width="24" height="2.6" fill="#B22234" />
      <rect y="15.4" width="24" height="2.6" fill="#B22234" />
      <rect width="10.5" height="9.8" fill="#3C3B6E" />
      <circle cx="3" cy="3" r="0.8" fill="#FFFFFF" />
      <circle cx="6.5" cy="3" r="0.8" fill="#FFFFFF" />
      <circle cx="4.8" cy="5.5" r="0.8" fill="#FFFFFF" />
      <circle cx="3" cy="7.5" r="0.8" fill="#FFFFFF" />
      <circle cx="6.5" cy="7.5" r="0.8" fill="#FFFFFF" />
    </svg>
  );
}

const LANG_OPTIONS: Array<{ value: Locale; label: string; apiLocale: string }> = [
  { value: "vi", label: "Tiếng Việt", apiLocale: "vi-VN" },
  { value: "en", label: "English", apiLocale: "en-US" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });

  useEffect(() => {
    const apiLoc = user.data?.settings?.locale;
    if (apiLoc?.startsWith("en")) setLocale("en");
    else if (apiLoc?.startsWith("vi")) setLocale("vi");
  }, [user.data?.settings?.locale, setLocale]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const save = useMutation({
    mutationFn: (apiLocale: string) => updateSettings({ locale: apiLocale }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save locale"),
  });

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={locale === "vi" ? "Ngôn ngữ: Tiếng Việt" : "Language: English"}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-secondary",
          open && "border-primary/60 bg-secondary"
        )}
      >
        {locale === "en" ? <UsFlag /> : <VietnamFlag />}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-40 rounded-xl border border-border bg-popover p-1 shadow-md"
        >
          {LANG_OPTIONS.map((opt) => {
            const active = locale === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLocale(opt.value);
                  setOpen(false);
                  if (user.data) save.mutate(opt.apiLocale);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  {opt.value === "en" ? <UsFlag /> : <VietnamFlag />}
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
