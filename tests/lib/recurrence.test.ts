/**
 * Tests for the recurrence engine (pure date math — no DB).
 *
 * Covers pattern parsing/validation and occurrence generation for
 * daily, weekly and monthly patterns, including the awkward cases:
 * intervals, month-ends that don't exist, `until` caps, and the
 * horizon window.
 */
import { describe, it, expect } from "vitest";
import {
  parseRecurrencePattern,
  serializeRecurrencePattern,
  occurrencesBetween,
  describeRecurrence,
  type RecurrencePattern,
} from "@/lib/recurrence";

/** 1 June 2026 is a Monday. 09:00–13:00 (4h). */
const BASE_START = new Date(2026, 5, 1, 9, 0, 0);
const BASE_END = new Date(2026, 5, 1, 13, 0, 0);

function starts(occs: { start: Date }[]): string[] {
  return occs.map((o) => o.start.toISOString());
}

describe("parseRecurrencePattern", () => {
  it("parses a valid daily pattern", () => {
    const p = parseRecurrencePattern('{"freq":"daily","interval":2}');
    expect(p).toEqual({ freq: "daily", interval: 2 });
  });

  it("defaults interval to 1 when missing or invalid", () => {
    expect(parseRecurrencePattern('{"freq":"daily"}')!.interval).toBe(1);
    expect(parseRecurrencePattern('{"freq":"daily","interval":0}')!.interval).toBe(1);
  });

  it("parses weekly days and drops out-of-range values", () => {
    const p = parseRecurrencePattern('{"freq":"weekly","days":[1,3,9,-2,5]}');
    expect(p!.days).toEqual([1, 3, 5]);
  });

  it("parses a monthly dayOfMonth", () => {
    const p = parseRecurrencePattern('{"freq":"monthly","dayOfMonth":15}');
    expect(p!.dayOfMonth).toBe(15);
  });

  it("returns null for malformed JSON, unknown freq, or empty input", () => {
    expect(parseRecurrencePattern("not json")).toBeNull();
    expect(parseRecurrencePattern('{"freq":"yearly"}')).toBeNull();
    expect(parseRecurrencePattern(null)).toBeNull();
    expect(parseRecurrencePattern("")).toBeNull();
  });

  it("round-trips through serialize", () => {
    const pattern: RecurrencePattern = {
      freq: "weekly",
      interval: 1,
      days: [1, 5],
    };
    expect(parseRecurrencePattern(serializeRecurrencePattern(pattern))).toEqual(
      pattern
    );
  });
});

describe("occurrencesBetween — daily", () => {
  it("generates one per day, preserving time-of-day and duration", () => {
    const occs = occurrencesBetween(
      { freq: "daily", interval: 1 },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 5, 4, 23, 59)
    );

    expect(occs).toHaveLength(4); // Jun 1,2,3,4
    expect(occs[0].start.getHours()).toBe(9);
    // 4-hour duration carried over
    expect(occs[2].end.getTime() - occs[2].start.getTime()).toBe(4 * 60 * 60 * 1000);
    expect(occs[3].start.getDate()).toBe(4);
  });

  it("honours an interval of 2 (every other day)", () => {
    const occs = occurrencesBetween(
      { freq: "daily", interval: 2 },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 5, 7, 23, 59)
    );

    expect(occs.map((o) => o.start.getDate())).toEqual([1, 3, 5, 7]);
  });
});

describe("occurrencesBetween — weekly", () => {
  it("generates on the chosen weekdays only", () => {
    // Mon(1), Wed(3), Fri(5) across two weeks from Mon 1 Jun.
    const occs = occurrencesBetween(
      { freq: "weekly", interval: 1, days: [1, 3, 5] },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 5, 12, 23, 59)
    );

    // Jun 1(Mon) 3(Wed) 5(Fri) 8(Mon) 10(Wed) 12(Fri)
    expect(occs.map((o) => o.start.getDate())).toEqual([1, 3, 5, 8, 10, 12]);
  });

  it("never generates before the series start, even earlier in the same week", () => {
    // Base is Monday; asking for Sunday(0) too. The Sunday BEFORE the base
    // Monday must not appear.
    const occs = occurrencesBetween(
      { freq: "weekly", interval: 1, days: [0, 1] },
      BASE_START,
      BASE_END,
      new Date(2026, 4, 1), // window opens well before the series
      new Date(2026, 5, 8, 23, 59)
    );

    // Jun 1 (Mon, base), Jun 7 (Sun), Jun 8 (Mon) — NOT May 31 (Sun).
    expect(occs.map((o) => o.start.getDate())).toEqual([1, 7, 8]);
  });

  it("defaults to the start's weekday when no days are given", () => {
    const occs = occurrencesBetween(
      { freq: "weekly", interval: 1 },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 5, 15, 23, 59)
    );

    // Every Monday: Jun 1, 8, 15
    expect(occs.map((o) => o.start.getDate())).toEqual([1, 8, 15]);
  });

  it("honours an interval of 2 (skips a week)", () => {
    const occs = occurrencesBetween(
      { freq: "weekly", interval: 2 },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 5, 29, 23, 59)
    );

    // Mondays every 2 weeks: Jun 1, 15, 29
    expect(occs.map((o) => o.start.getDate())).toEqual([1, 15, 29]);
  });
});

describe("occurrencesBetween — monthly", () => {
  it("repeats on the same day each month", () => {
    const occs = occurrencesBetween(
      { freq: "monthly", interval: 1 },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 8, 30) // through September
    );

    // 1 Jun, 1 Jul, 1 Aug, 1 Sep
    expect(occs.map((o) => o.start.getMonth())).toEqual([5, 6, 7, 8]);
    expect(occs.every((o) => o.start.getDate() === 1)).toBe(true);
  });

  it("skips months that don't have the requested day (e.g. the 31st)", () => {
    const jan31 = new Date(2027, 0, 31, 9, 0);
    const jan31End = new Date(2027, 0, 31, 13, 0);

    const occs = occurrencesBetween(
      { freq: "monthly", interval: 1, dayOfMonth: 31 },
      jan31,
      jan31End,
      jan31,
      new Date(2027, 3, 30) // through April
    );

    // Jan 31 and Mar 31 exist; February has no 31st, April has no 31st.
    expect(occs.map((o) => o.start.getMonth())).toEqual([0, 2]);
  });
});

describe("occurrencesBetween — bounds", () => {
  it("stops at the pattern's `until` date", () => {
    const occs = occurrencesBetween(
      { freq: "daily", interval: 1, until: "2026-06-03" },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 5, 30) // horizon is far out; `until` should win
    );

    expect(occs.map((o) => o.start.getDate())).toEqual([1, 2, 3]);
  });

  it("stops at the caller's horizon when there is no `until`", () => {
    const occs = occurrencesBetween(
      { freq: "daily", interval: 1 },
      BASE_START,
      BASE_END,
      BASE_START,
      new Date(2026, 5, 2, 23, 59)
    );

    expect(occs).toHaveLength(2);
  });

  it("excludes occurrences before the `from` window", () => {
    const occs = occurrencesBetween(
      { freq: "daily", interval: 1 },
      BASE_START,
      BASE_END,
      new Date(2026, 5, 5), // window opens on the 5th
      new Date(2026, 5, 7, 23, 59)
    );

    expect(occs.map((o) => o.start.getDate())).toEqual([5, 6, 7]);
  });
});

describe("describeRecurrence", () => {
  it("describes weekly patterns with day names", () => {
    expect(describeRecurrence({ freq: "weekly", interval: 1, days: [1, 3] })).toBe(
      "Every week on Mon, Wed"
    );
  });

  it("describes intervals in the plural", () => {
    expect(describeRecurrence({ freq: "daily", interval: 3 })).toBe("Every 3 days");
  });
});
