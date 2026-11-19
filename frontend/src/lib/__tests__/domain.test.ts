import { describe, expect, it } from "vitest";

import { ACCENT_DOT_CLASSES, formatElapsedSeconds, formatMinutes } from "@/lib/utils";
import type { Task, TaskOccurrence } from "@/types/domain";

describe("domain utilities and invariants", () => {
  it("formats minutes cleanly without floating point noise", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(null)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(95)).toBe("1h 35m");
  });

  it("formats timer elapsed seconds consistently as HH:MM:SS", () => {
    expect(formatElapsedSeconds(0)).toBe("00:00:00");
    expect(formatElapsedSeconds(65)).toBe("00:01:05");
    expect(formatElapsedSeconds(3661)).toBe("01:01:01");
  });

  it("provides semantic dot classes for all accent tokens", () => {
    expect(Object.keys(ACCENT_DOT_CLASSES)).toEqual([
      "LAVENDER",
      "SAGE",
      "PEACH",
      "ROSE",
      "BUTTER",
      "SKY",
      "SLATE",
    ]);
  });

  it("keeps Task definition separate from TaskOccurrence execution status", () => {
    const occ: TaskOccurrence = {
      id: "occ-1",
      task_id: "task-1",
      recurrence_rule_id: null,
      recurrence_key: "ONCE",
      scheduled_date: "2026-11-19",
      start_at: null,
      end_at: null,
      due_at: null,
      estimated_minutes: 30,
      status: "DONE",
      completed_at: "2026-11-19T12:00:00Z",
      is_override: false,
      sort_order: 0,
      version: 1,
      created_at: "2026-11-19T10:00:00Z",
      updated_at: "2026-11-19T12:00:00Z",
    };

    const task: Task = {
      id: "task-1",
      project_id: null,
      category_id: null,
      parent_task_id: null,
      title: "Practice IELTS Listening",
      description: null,
      priority: "HIGH",
      estimated_minutes: 30,
      due_at: null,
      is_recurring: true,
      version: 1,
      archived_at: null,
      created_at: "2026-11-19T10:00:00Z",
      updated_at: "2026-11-19T10:00:00Z",
      occurrences: [occ],
    };

    expect("status" in task).toBe(false);
    expect(task.occurrences[0]?.status).toBe("DONE");
  });
});
