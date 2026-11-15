import { describe, expect, it } from "vitest";
import { makeItem, makeLog, makeMember } from "@/test/fixtures";
import type { Appointment, Member } from "./types";
import {
  appointmentRecipients,
  circleRecipients,
  notificationKey,
  planReminders,
  upcomingReminders,
  type ReminderInput,
} from "./reminders";

// 08:00 IST on 15 Nov 2026 is 02:30 UTC.
const SLOT = "2026-11-15T02:30:00.000Z";
const at = (minFromSlot: number) => new Date(Date.parse(SLOT) + minFromSlot * 60_000);

const elder = makeMember({ id: "m-elder", email: "kamla@example.com" });
const priya = makeMember({
  id: "m-priya",
  name: "Priya",
  role: "family",
  isOrganiser: false,
  email: "priya@example.com",
});
const ramesh = makeMember({
  id: "m-ramesh",
  name: "Ramesh",
  role: "caretaker",
  access: "view",
  isOrganiser: false,
  email: "ramesh@example.com",
  alerts: { missed: false, appointments: false },
});

function input(over: Partial<ReminderInput> = {}): ReminderInput {
  return {
    circle: { timezone: "Asia/Kolkata" },
    members: [elder, priya, ramesh],
    items: [
      makeItem({ id: "met" }),
      makeItem({ id: "aml", name: "Amlodipine", composition: null }),
    ],
    logs: [],
    appointments: [],
    sentKeys: new Set(),
    now: at(0),
    ...over,
  };
}

const sent = (...keys: string[]) => new Set(keys);
const stages = (i: ReminderInput) => planReminders(i).map((r) => `${r.stage}:${r.memberId}`);

describe("planReminders — dose ladder", () => {
  it("sends nothing before the due window opens at T−10", () => {
    expect(planReminders(input({ now: at(-11) }))).toEqual([]);
  });

  it("sends one due email to the elder at T−10 grouping every pending item in the slot", () => {
    const [r, ...rest] = planReminders(input({ now: at(-10) }));
    expect(rest).toEqual([]);
    expect(r).toEqual({
      key: notificationKey(SLOT, "due", "m-elder"),
      stage: "due",
      memberId: "m-elder",
      at: SLOT,
      itemIds: ["met", "aml"],
      appointmentId: null,
    });
  });

  it("lists only the items still waiting when part of the slot is logged", () => {
    const logs = [makeLog({ itemId: "met", scheduledAt: SLOT })];
    expect(planReminders(input({ logs, now: at(0) }))[0]?.itemIds).toEqual(["aml"]);
  });

  it("sends nothing for a fully logged slot, skipped items included", () => {
    const logs = [
      makeLog({ itemId: "met", scheduledAt: SLOT }),
      makeLog({ itemId: "aml", scheduledAt: SLOT, status: "skipped", reason: "ran-out" }),
    ];
    expect(planReminders(input({ logs, now: at(90) }))).toEqual([]);
  });

  it("does not repeat the due email on a later tick", () => {
    const keys = sent(notificationKey(SLOT, "due", "m-elder"));
    expect(planReminders(input({ sentKeys: keys, now: at(5) }))).toEqual([]);
  });

  it("sends the elder's second nudge at T+30", () => {
    const keys = sent(notificationKey(SLOT, "due", "m-elder"));
    expect(stages(input({ sentKeys: keys, now: at(29) }))).toEqual([]);
    expect(stages(input({ sentKeys: keys, now: at(30) }))).toEqual(["missed-elder:m-elder"]);
  });

  it("skips the stale due email when the tick runs late and sends the nudge instead", () => {
    expect(stages(input({ now: at(45) }))).toEqual(["missed-elder:m-elder"]);
  });

  it("escalates to opted-in members at T+60 only after the elder was nudged", () => {
    const nudged = sent(
      notificationKey(SLOT, "due", "m-elder"),
      notificationKey(SLOT, "missed-elder", "m-elder"),
    );
    expect(stages(input({ sentKeys: nudged, now: at(59) }))).toEqual([]);
    expect(stages(input({ sentKeys: nudged, now: at(60) }))).toEqual(["missed-circle:m-priya"]);
  });

  it("tells the elder first even when a late tick finds the slot past T+60", () => {
    expect(stages(input({ now: at(75) }))).toEqual(["missed-elder:m-elder"]);
  });

  it("escalates straight to the circle when the elder has no email", () => {
    const noEmail = makeMember({ id: "m-elder", email: null });
    expect(stages(input({ members: [noEmail, priya], now: at(60) }))).toEqual([
      "missed-circle:m-priya",
    ]);
    expect(stages(input({ members: [noEmail, priya], now: at(0) }))).toEqual([]);
  });

  it("never escalates to members who opted out or have no email", () => {
    const noMail = makeMember({ ...priya, id: "m-x", email: null });
    expect(circleRecipients([elder, priya, ramesh, noMail]).map((m) => m.id)).toEqual(["m-priya"]);
  });

  it("does not repeat escalation once sent", () => {
    const all = sent(
      notificationKey(SLOT, "missed-elder", "m-elder"),
      notificationKey(SLOT, "missed-circle", "m-priya"),
    );
    expect(planReminders(input({ sentKeys: all, now: at(120) }))).toEqual([]);
  });

  it("ignores slots older than six hours", () => {
    expect(planReminders(input({ now: at(6 * 60 + 1) }))).toEqual([]);
    expect(stages(input({ now: at(6 * 60) }))).toEqual(["missed-elder:m-elder"]);
  });

  it("ignores paused items and items that ended", () => {
    const items = [
      makeItem({ id: "met", active: false }),
      makeItem({ id: "aml", endDate: "2026-11-14" }),
    ];
    expect(planReminders(input({ items, now: at(0) }))).toEqual([]);
  });

  it("ignores slots from before an item was created", () => {
    const items = [makeItem({ id: "met", createdAt: at(50).toISOString() })];
    expect(planReminders(input({ items, now: at(60) }))).toEqual([]);
  });

  it("returns the same plan on a repeated run with the same inputs (idempotent)", () => {
    const i = input({ now: at(35) });
    expect(planReminders(i)).toEqual(planReminders(i));
  });

  it("handles a slot just after midnight from a tick late the previous evening", () => {
    // 00:05 IST on 16 Nov is 18:35 UTC on 15 Nov; the tick at 23:55 IST is still on the 15th.
    const items = [makeItem({ id: "late", times: ["00:05"] })];
    const now = new Date("2026-11-15T18:25:00.000Z");
    const [r] = planReminders(input({ items, now }));
    expect(r?.at).toBe("2026-11-15T18:35:00.000Z");
    expect(r?.stage).toBe("due");
  });

  it("handles a late-evening slot from a tick after midnight", () => {
    const items = [makeItem({ id: "night", times: ["23:30"] })];
    // 23:30 IST on 15 Nov = 18:00 UTC; tick at 00:31 IST on the 16th = 19:01 UTC.
    const now = new Date("2026-11-15T19:01:00.000Z");
    const keys = sent(notificationKey("2026-11-15T18:00:00.000Z", "missed-elder", "m-elder"));
    expect(stages(input({ items, now, sentKeys: keys }))).toEqual(["missed-circle:m-priya"]);
  });

  it("uses the circle's timezone for slot times", () => {
    const items = [makeItem({ id: "met", times: ["08:00"] })];
    // 08:00 in London (GMT in November) is 08:00 UTC.
    const now = new Date("2026-11-15T07:50:00.000Z");
    const [r] = planReminders(input({ circle: { timezone: "Europe/London" }, items, now }));
    expect(r?.at).toBe("2026-11-15T08:00:00.000Z");
  });
});

describe("planReminders — appointments", () => {
  const appt: Appointment = {
    id: "a1",
    doctor: "Dr Mehta",
    specialty: "Cardiology",
    location: "City Clinic",
    at: "2026-11-16T05:30:00.000Z",
    notes: "",
  };
  const apptAt = (minBefore: number) => new Date(Date.parse(appt.at) - minBefore * 60_000);
  const only = (members: Member[], now: Date, keys = new Set<string>()) =>
    planReminders(input({ members, items: [], appointments: [appt], now, sentKeys: keys })).map(
      (r) => `${r.stage}:${r.memberId}`,
    );

  it("sends the 24-hour reminder to everyone who opted in, elder included", () => {
    expect(only([elder, priya, ramesh], apptAt(24 * 60))).toEqual([
      "appt-24h:m-elder",
      "appt-24h:m-priya",
    ]);
    expect(only([elder], apptAt(24 * 60 + 1))).toEqual([]);
  });

  it("sends only the latest open stage when an appointment is added late", () => {
    expect(only([elder], apptAt(121))).toEqual(["appt-24h:m-elder"]);
    expect(only([elder], apptAt(119))).toEqual(["appt-2h:m-elder"]);
  });

  it("moves from the 24-hour to the 2-hour stage", () => {
    const keys = sent(notificationKey(appt.at, "appt-24h", "m-elder"));
    expect(only([elder], apptAt(120), keys)).toEqual(["appt-2h:m-elder"]);
    const both = sent(notificationKey(appt.at, "appt-2h", "m-elder"));
    expect(only([elder], apptAt(60), both)).toEqual([]);
  });

  it("sends nothing once the appointment has started", () => {
    expect(only([elder], apptAt(0))).toEqual([]);
  });

  it("filters appointment recipients by opt-in and email", () => {
    expect(appointmentRecipients([elder, priya, ramesh]).map((m) => m.id)).toEqual([
      "m-elder",
      "m-priya",
    ]);
  });
});

describe("upcomingReminders", () => {
  it("lists the elder's next due emails and appointment stages within the horizon", () => {
    const appt: Appointment = {
      id: "a1",
      doctor: "Dr Mehta",
      specialty: "",
      location: "",
      at: at(20 * 60).toISOString(),
      notes: "",
    };
    const items = [makeItem({ id: "met", times: ["08:00", "20:00"] })];
    const list = upcomingReminders(input({ items, appointments: [appt], now: at(-60) }), 24 * 60);
    expect(list.map((u) => u.stage)).toEqual(["due", "due", "appt-2h"]);
    expect(list[0]?.sendAt).toBe(at(-10).toISOString());
    expect(list[0]?.memberIds).toEqual(["m-elder"]);
    expect(list[2]?.memberIds).toEqual(["m-elder", "m-priya"]);
  });

  it("is empty when nobody has an email", () => {
    const quiet = [makeMember({ id: "m-elder", email: null })];
    expect(upcomingReminders(input({ members: quiet, now: at(-60) }), 600)).toEqual([]);
  });
});
