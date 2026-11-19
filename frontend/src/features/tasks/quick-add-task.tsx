"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

interface QuickAddTaskProps {
  placeholder?: string;
  isSubmitting?: boolean;
  onCreate: (title: string) => Promise<void>;
}

export function QuickAddTask({
  placeholder = "Add a task and press Enter...",
  isSubmitting = false,
  onCreate,
}: QuickAddTaskProps) {
  const [title, setTitle] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned = title.trim();
    if (!cleaned || isSubmitting) return;
    await onCreate(cleaned);
    setTitle("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 focus-within:border-primary"
    >
      <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        disabled={isSubmitting}
        aria-label="Quick add task"
        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={isSubmitting || !title.trim()}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
      >
        {isSubmitting ? "Saving..." : "Add"}
      </button>
    </form>
  );
}
