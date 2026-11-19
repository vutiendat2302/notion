"use client";

import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";

import { formatElapsedSeconds } from "@/lib/utils";

export function FocusTimerPill() {
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const intervalId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [running]);

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${
          running ? "bg-[var(--category-sage)]" : "bg-muted-foreground/40"
        }`}
        aria-hidden="true"
      />
      <span className="font-mono tabular-nums text-foreground">
        {formatElapsedSeconds(elapsedSeconds)}
      </span>
      <button
        type="button"
        onClick={() => setRunning((prev) => !prev)}
        aria-label={running ? "Pause focus timer" : "Start focus timer"}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      {elapsedSeconds > 0 && (
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setElapsedSeconds(0);
          }}
          aria-label="Reset focus timer"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
