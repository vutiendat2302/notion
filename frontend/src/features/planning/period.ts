import type { OccurrenceWithTask, PeriodType } from "@/types/domain";

export type PeriodScope = Lowercase<PeriodType>;

export interface PeriodWindow {
  scope: PeriodScope;
  key: string;
  start: string;
  endExclusive: string;
  endInclusive: string;
  title: string;
}

const DAY_MS = 86_400_000;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(value: string): Date | null {
  if (!VALID_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day, 12));
  return result.getUTCFullYear() === year &&
    result.getUTCMonth() + 1 === month &&
    result.getUTCDate() === day
    ? result
    : null;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function monday(date: Date): Date {
  const weekday = date.getUTCDay() || 7;
  return addDays(date, 1 - weekday);
}

function isoWeek(date: Date): { year: number; week: number; start: Date } {
  const start = monday(date);
  const thursday = addDays(start, 3);
  const year = thursday.getUTCFullYear();
  const first = monday(new Date(Date.UTC(year, 0, 4, 12)));
  return { year, week: Math.round((start.getTime() - first.getTime()) / (7 * DAY_MS)) + 1, start };
}

export function periodKeyForDate(scope: PeriodScope, value: string): string | null {
  const date = utcDate(value);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (scope === "year") return String(year);
  if (scope === "quarter") return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  if (scope === "month") return `${year}-${month}`;
  if (scope === "week") {
    const result = isoWeek(date);
    return `${result.year}-W${String(result.week).padStart(2, "0")}`;
  }
  return value;
}

export function parsePeriod(scope: PeriodScope, key: string): PeriodWindow | null {
  let start: Date | null = null;
  let end: Date | null = null;
  if (scope === "year" && /^\d{4}$/.test(key)) {
    const year = Number(key);
    start = new Date(Date.UTC(year, 0, 1, 12));
    end = new Date(Date.UTC(year + 1, 0, 1, 12));
  } else if (scope === "quarter" && /^\d{4}-Q[1-4]$/.test(key)) {
    const year = Number(key.slice(0, 4));
    const month = (Number(key.slice(-1)) - 1) * 3;
    start = new Date(Date.UTC(year, month, 1, 12));
    end = new Date(Date.UTC(year, month + 3, 1, 12));
  } else if (scope === "month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(key)) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7)) - 1;
    start = new Date(Date.UTC(year, month, 1, 12));
    end = new Date(Date.UTC(year, month + 1, 1, 12));
  } else if (scope === "week" && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(key)) {
    const year = Number(key.slice(0, 4));
    const week = Number(key.slice(6, 8));
    start = addDays(monday(new Date(Date.UTC(year, 0, 4, 12))), (week - 1) * 7);
    if (periodKeyForDate("week", iso(start)) !== key) return null;
    end = addDays(start, 7);
  } else if (scope === "day") {
    start = utcDate(key);
    if (start) end = addDays(start, 1);
  }
  if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return null;
  }
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    year: "numeric",
    month: scope === "year" ? undefined : "long",
    day: scope === "day" ? "numeric" : undefined,
  });
  const title = scope === "quarter" ? `Quý ${key.slice(-1)} · ${key.slice(0, 4)}` :
    scope === "week" ? `Tuần ${key.slice(-2)} · ${key.slice(0, 4)}` : formatter.format(start);
  return { scope, key, start: iso(start), endExclusive: iso(end), endInclusive: iso(addDays(end, -1)), title };
}

export function shiftPeriod(scope: PeriodScope, key: string, amount: number): string | null {
  const period = parsePeriod(scope, key);
  if (!period) return null;
  const start = utcDate(period.start);
  if (!start) return null;
  if (scope === "year") start.setUTCFullYear(start.getUTCFullYear() + amount);
  else if (scope === "quarter") start.setUTCMonth(start.getUTCMonth() + amount * 3);
  else if (scope === "month") start.setUTCMonth(start.getUTCMonth() + amount);
  else start.setUTCDate(start.getUTCDate() + amount * (scope === "week" ? 7 : 1));
  return periodKeyForDate(scope, iso(start));
}

export function dateInTimeZone(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function occurrenceDate(item: OccurrenceWithTask, timeZone: string): string | null {
  if (item.scheduled_date) return item.scheduled_date;
  if (item.start_at) return dateInTimeZone(item.start_at, timeZone);
  if (item.due_at) return dateInTimeZone(item.due_at, timeZone);
  return null;
}

export function occurrencesInPeriod(
  items: OccurrenceWithTask[],
  period: PeriodWindow,
  timeZone: string
): OccurrenceWithTask[] {
  return items.filter((item) => {
    const day = occurrenceDate(item, timeZone);
    return day !== null && day >= period.start && day < period.endExclusive;
  });
}
