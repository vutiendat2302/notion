import { apiRequest } from "@/lib/api/client";

export interface CalendarOccurrence {
  occurrence_id: string;
  task_id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  start_at: string | null;
  end_at: string | null;
  due_at: string | null;
}

export interface CalendarEvents {
  start: string;
  end: string;
  timezone: string;
  all_day_occurrences: CalendarOccurrence[];
  timed_occurrences: CalendarOccurrence[];
  due_markers: { occurrence_id: string; task_id: string; title: string; due_at: string }[];
}

export interface CalendarConflicts {
  has_conflict: boolean;
  conflicts: CalendarOccurrence[];
}

export function fetchCalendarEvents(start: string, end: string): Promise<CalendarEvents> {
  return apiRequest<CalendarEvents>(`/calendar/events?${new URLSearchParams({ start, end })}`);
}

export function fetchCalendarConflicts(startAt: string, endAt: string, excludeId: string): Promise<CalendarConflicts> {
  return apiRequest<CalendarConflicts>(`/calendar/conflicts?${new URLSearchParams({ start_at: startAt, end_at: endAt, exclude_occurrence_id: excludeId })}`);
}
