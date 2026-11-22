"use client";

import { useQuery } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchActiveTimer } from "@/features/time-tracking/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

function formatShort(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function FocusTimerPill() {
  const { locale } = useI18n();
  const activeQuery = useQuery({
    queryKey: ["active-timer"],
    queryFn: fetchActiveTimer,
    retry: false,
    refetchInterval: 30_000,
  });

  const entry = activeQuery.data?.active_entry ?? null;
  const [tickNow, setTickNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!entry || entry.status !== "RUNNING") return;
    const id = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [entry]);

  let remainingDisplay: string | null = null;
  if (entry) {
    const serverTs = Date.parse(entry.server_now);
    const localDelta =
      entry.status === "RUNNING" && Number.isFinite(serverTs)
        ? Math.max(0, Math.floor((tickNow - serverTs) / 1000))
        : 0;
    const elapsed = entry.effective_elapsed_seconds + localDelta;
    if (entry.planned_duration_seconds) {
      remainingDisplay = formatShort(Math.max(0, entry.planned_duration_seconds - elapsed));
    } else {
      remainingDisplay = formatShort(elapsed);
    }
  }

  return (
    <Link
      href="/time-tracking"
      title={locale === "en" ? "Countdown" : "Đếm ngược"}
      aria-label={locale === "en" ? "Countdown" : "Đếm ngược"}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
        entry
          ? "border-primary/50 bg-accent text-accent-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary"
      )}
    >
      <Timer className={cn("h-4 w-4", entry ? "text-primary" : "text-primary")} aria-hidden="true" />
      {remainingDisplay && <span className="font-mono tabular-nums">{remainingDisplay}</span>}
    </Link>
  );
}
