import { describe, expect, it } from "vitest";
import {
  addDays,
  clockLabel,
  dateRange,
  dayPart,
  greetingPart,
  isValidTimeZone,
  longDate,
  shortWeekday,
  to12h,
  todayIn,
  weekdayOf,
  zoneOffsetMinutes,
  zonedParts,
  zonedToUtc,
} from "./time";

const IST = "Asia/Kolkata";

describe("zone conversion", () => {
  it("converts Kolkata wall-clock time to UTC", () => {
    expect(zonedToUtc("2026-11-14", "08:00", IST).toISOString()).toBe("2026-11-14T02:30:00.000Z");
  });

  it("puts a 00:30 Kolkata slot on the previous UTC day", () => {
    expect(zonedToUtc("2026-11-14", "00:30", IST).toISOString()).toBe("2026-11-13T19:00:00.000Z");
  });

  it("reads the Kolkata date of a UTC instant just before local midnight", () => {
    expect(zonedParts("2026-11-14T18:29:00Z", IST)).toEqual({
      date: "2026-11-14",
      time: "23:59",
      weekday: 6,
    });
    expect(zonedParts(new Date("2026-11-14T18:30:00Z"), IST).date).toBe("2026-11-15");
  });

  it("handles a daylight-saving spring-forward day", () => {
    // 8 March 2026: New York jumps from 02:00 to 03:00 local.
    expect(zonedToUtc("2026-03-08", "08:00", "America/New_York").toISOString()).toBe(
      "2026-03-08T12:00:00.000Z",
    );
    expect(zonedToUtc("2026-03-07", "08:00", "America/New_York").toISOString()).toBe(
      "2026-03-07T13:00:00.000Z",
    );
  });

  it("reports the zone offset in minutes", () => {
    expect(zoneOffsetMinutes(Date.parse("2026-11-14T00:00:00Z"), IST)).toBe(330);
  });

  it("validates timezone names", () => {
    expect(isValidTimeZone(IST)).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("knows today's date in a zone", () => {
    expect(todayIn(IST, new Date("2026-11-14T20:00:00Z"))).toBe("2026-11-15");
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("lists an inclusive date range, empty when reversed", () => {
    expect(dateRange("2026-11-13", "2026-11-15")).toEqual([
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(dateRange("2026-11-15", "2026-11-13")).toEqual([]);
  });

  it("finds the weekday of a date", () => {
    expect(weekdayOf("2026-11-15")).toBe(0);
    expect(shortWeekday("2026-11-14")).toBe("Sa");
  });
});

describe("labels", () => {
  it("formats 12-hour times including midnight and noon", () => {
    expect(to12h("00:05").label).toBe("12:05 AM");
    expect(to12h("12:00").label).toBe("12:00 PM");
    expect(to12h("20:30")).toEqual({ time: "8:30", meridiem: "PM", label: "8:30 PM" });
  });

  it("labels an instant on the local clock", () => {
    expect(clockLabel("2026-11-14T02:35:00Z", IST)).toBe("8:05 AM");
  });

  it("names parts of the day", () => {
    expect(dayPart("07:00")).toBe("morning");
    expect(dayPart("13:00")).toBe("afternoon");
    expect(dayPart("20:00")).toBe("evening");
    expect(dayPart("23:00")).toBe("night");
    expect(dayPart("03:00")).toBe("night");
  });

  it("picks a greeting for the local hour", () => {
    expect(greetingPart(new Date("2026-11-14T02:30:00Z"), IST)).toBe("morning");
    expect(greetingPart(new Date("2026-11-14T08:30:00Z"), IST)).toBe("afternoon");
    expect(greetingPart(new Date("2026-11-14T14:30:00Z"), IST)).toBe("evening");
  });

  it("writes a long date", () => {
    expect(longDate("2026-11-14T06:00:00Z", IST)).toBe("Saturday 14 November");
  });
});
