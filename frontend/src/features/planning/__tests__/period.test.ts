import { describe, expect, it } from "vitest";

import {
  dateInTimeZone,
  parsePeriod,
  periodKeyForDate,
  shiftPeriod,
} from "@/features/planning/period";

describe("canonical planning periods", () => {
  it("uses ISO week-year at the year boundary", () => {
    expect(periodKeyForDate("week", "2027-01-01")).toBe("2026-W53");
    expect(parsePeriod("week", "2026-W53")).toMatchObject({
      start: "2026-12-28",
      endExclusive: "2027-01-04",
      endInclusive: "2027-01-03",
    });
    expect(shiftPeriod("week", "2026-W53", 1)).toBe("2027-W01");
  });

  it("rejects noncanonical dates and impossible week numbers", () => {
    expect(parsePeriod("day", "2026-02-30")).toBeNull();
    expect(parsePeriod("week", "2026-W54")).toBeNull();
  });

  it("uses half-open month and quarter boundaries", () => {
    expect(parsePeriod("month", "2028-02")).toMatchObject({
      start: "2028-02-01",
      endExclusive: "2028-03-01",
      endInclusive: "2028-02-29",
    });
    expect(parsePeriod("quarter", "2026-Q4")).toMatchObject({
      start: "2026-10-01",
      endExclusive: "2027-01-01",
    });
  });

  it("formats current day in the user timezone", () => {
    expect(dateInTimeZone("2026-11-19T20:30:00Z", "Asia/Ho_Chi_Minh")).toBe("2026-11-20");
  });
});
