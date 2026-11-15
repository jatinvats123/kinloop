import { describe, expect, it } from "vitest";
import { makeItem, makeLog } from "@/test/fixtures";
import {
  groupByTime,
  indexLogs,
  isScheduledOn,
  logId,
  normaliseTimes,
  slotsForRange,
} from "./schedule";
import { groupStatus, isPastMissedThreshold, slotStatus } from "./status";

const IST = "Asia/Kolkata";

describe("isScheduledOn", () => {
  it("excludes paused items", () => {
    expect(isScheduledOn(makeItem({ active: false }), "2026-11-14")).toBe(false);
  });

  it("respects start and end dates inclusively", () => {
    const item = makeItem({ startDate: "2026-11-10", endDate: "2026-11-12" });
    expect(isScheduledOn(item, "2026-11-09")).toBe(false);
    expect(isScheduledOn(item, "2026-11-10")).toBe(true);
    expect(isScheduledOn(item, "2026-11-12")).toBe(true);
    expect(isScheduledOn(item, "2026-11-13")).toBe(false);
  });

  it("only schedules on chosen weekdays", () => {
    const mondays = makeItem({ daysOfWeek: [1] });
    expect(isScheduledOn(mondays, "2026-11-16")).toBe(true);
    expect(isScheduledOn(mondays, "2026-11-15")).toBe(false);
  });
});

describe("slotsForRange", () => {
  it("derives one slot per time per day in UTC, sorted by instant", () => {
    const items = [
      makeItem({ id: "a", times: ["20:00", "08:00"] }),
      makeItem({ id: "b", kind: "routine", name: "Walk", times: ["18:00"] }),
    ];
    const slots = slotsForRange(items, "2026-11-14", "2026-11-14", IST);
    expect(slots.map((s) => `${s.itemId}@${s.time}`)).toEqual(["a@08:00", "b@18:00", "a@20:00"]);
    expect(slots[0]?.at).toBe("2026-11-14T02:30:00.000Z");
  });

  it("keeps a late-night local slot on its local date", () => {
    const [slot] = slotsForRange([makeItem({ times: ["23:30"] })], "2026-11-14", "2026-11-14", IST);
    expect(slot).toMatchObject({ date: "2026-11-14", at: "2026-11-14T18:00:00.000Z" });
  });

  it("stops after the end date and skips paused items", () => {
    const items = [
      makeItem({ id: "a", endDate: "2026-11-14" }),
      makeItem({ id: "b", active: false }),
    ];
    expect(slotsForRange(items, "2026-11-13", "2026-11-16", IST)).toHaveLength(2);
  });
});

describe("grouping and ids", () => {
  it("groups the same local time into one card", () => {
    const items = [
      makeItem({ id: "a" }),
      makeItem({ id: "b" }),
      makeItem({ id: "c", times: ["13:00"] }),
    ];
    const groups = groupByTime(slotsForRange(items, "2026-11-14", "2026-11-14", IST));
    expect(groups.map((g) => [g.time, g.slots.length])).toEqual([
      ["08:00", 2],
      ["13:00", 1],
    ]);
  });

  it("builds deterministic log ids so a repeat log overwrites, never duplicates", () => {
    const at = "2026-11-14T02:30:00.000Z";
    expect(logId("met", at)).toBe(logId("met", at));
    const idx = indexLogs([
      makeLog({ itemId: "met", scheduledAt: at }),
      makeLog({ itemId: "met", scheduledAt: at, status: "skipped" }),
    ]);
    expect(idx.size).toBe(1);
  });

  it("normalises times", () => {
    expect(normaliseTimes([" 20:00", "08:00", "20:00"])).toEqual(["08:00", "20:00"]);
  });
});

describe("slot status", () => {
  const at = "2026-11-14T02:30:00.000Z"; // 08:00 IST
  const now = (iso: string) => new Date(iso);

  it("is upcoming more than an hour before", () => {
    expect(slotStatus({ at }, undefined, now("2026-11-14T01:00:00Z"))).toBe("upcoming");
  });

  it("is due from an hour before until the missed threshold", () => {
    expect(slotStatus({ at }, undefined, now("2026-11-14T01:30:00Z"))).toBe("due");
    expect(slotStatus({ at }, undefined, now("2026-11-14T03:29:00Z"))).toBe("due");
  });

  it("is missed once an hour has passed with no log", () => {
    expect(slotStatus({ at }, undefined, now("2026-11-14T03:30:00Z"))).toBe("missed");
    expect(isPastMissedThreshold(at, now("2026-11-14T03:30:00Z"))).toBe(true);
  });

  it("uses the log when there is one", () => {
    const log = makeLog({ itemId: "met", scheduledAt: at, status: "skipped" });
    expect(slotStatus({ at }, log, now("2026-11-14T10:00:00Z"))).toBe("skipped");
  });

  it("summarises a group", () => {
    expect(groupStatus([])).toBe("upcoming");
    expect(groupStatus(["taken", "skipped"])).toBe("taken");
    expect(groupStatus(["skipped", "skipped"])).toBe("skipped");
    expect(groupStatus(["taken", "missed"])).toBe("missed");
    expect(groupStatus(["taken", "due"])).toBe("due");
    expect(groupStatus(["upcoming", "taken"])).toBe("upcoming");
  });
});
