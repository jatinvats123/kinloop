import { describe, expect, it } from "vitest";
import { makeItem, makeLog } from "@/test/fixtures";
import { computeAdherence, streak, type DayTally } from "./adherence";
import { zonedToUtc } from "./time";

const IST = "Asia/Kolkata";
const at = (date: string, time: string) => zonedToUtc(date, time, IST).toISOString();

describe("computeAdherence", () => {
  const items = [makeItem({ id: "met", times: ["08:00", "20:00"] })];
  // "now" is 14 Nov 10:00 IST: the 14 Nov 08:00 slot is past its threshold, 20:00 is not.
  const now = new Date(at("2026-11-14", "10:00"));

  it("counts only doses past the missed threshold or logged", () => {
    const logs = [
      makeLog({ itemId: "met", scheduledAt: at("2026-11-13", "08:00") }),
      makeLog({
        itemId: "met",
        scheduledAt: at("2026-11-13", "20:00"),
        status: "skipped",
        reason: "felt-unwell",
      }),
      makeLog({ itemId: "met", scheduledAt: at("2026-11-14", "08:00") }),
    ];
    const r = computeAdherence(items, logs, "2026-11-14", 2, now, IST);
    expect(r.overall).toEqual({ taken: 2, skipped: 1, missed: 0, counted: 3, percent: 67 });
    expect(r.daily.map((d) => d.scheduled)).toEqual([2, 2]);
    expect(r.daily[1]?.counted).toBe(1);
  });

  it("treats an unlogged past slot as missed and finds the most-missed part of day", () => {
    const logs = [
      makeLog({ itemId: "met", scheduledAt: at("2026-11-12", "08:00") }),
      makeLog({ itemId: "met", scheduledAt: at("2026-11-13", "08:00") }),
    ];
    const r = computeAdherence(items, logs, "2026-11-14", 3, now, IST);
    expect(r.overall.missed).toBe(3);
    expect(r.mostMissedPart).toEqual({ part: "evening", count: 2 });
    expect(r.perItem[0]).toMatchObject({ itemId: "met", name: "Metformin", taken: 2 });
  });

  it("reports null percentages when nothing is countable", () => {
    const early = new Date(at("2026-11-14", "06:00"));
    const r = computeAdherence(items, [], "2026-11-14", 1, early, IST);
    expect(r.overall.percent).toBeNull();
    expect(r.perItem).toEqual([]);
    expect(r.mostMissedPart).toBeNull();
    expect(r.streakDays).toBe(0);
  });

  it("ignores logs outside the window", () => {
    const logs = [makeLog({ itemId: "met", scheduledAt: at("2026-10-01", "08:00") })];
    const r = computeAdherence(items, logs, "2026-11-14", 1, now, IST);
    expect(r.overall.taken).toBe(0);
  });
});

describe("streak", () => {
  const day = (counted: number, taken: number): DayTally => ({
    date: "x",
    scheduled: counted,
    counted,
    taken,
    skipped: 0,
    missed: counted - taken,
    percent: null,
  });

  it("counts back from today across complete days", () => {
    expect(streak([day(2, 1), day(2, 2), day(2, 2)])).toBe(2);
  });

  it("does not break on days with nothing counted, such as today in progress", () => {
    expect(streak([day(2, 2), day(0, 0), day(2, 2), day(0, 0)])).toBe(2);
  });

  it("is zero when the latest counted day had a miss", () => {
    expect(streak([day(2, 2), day(2, 1)])).toBe(0);
  });
});
