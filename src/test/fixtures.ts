// Test builders for domain objects with sensible defaults.
import type { Circle, DoseLog, Item, Member } from "@/domain/types";

export function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: "met",
    kind: "medicine",
    name: "Metformin",
    composition: "Metformin hydrochloride",
    dose: "500 mg",
    instructions: "After breakfast",
    times: ["08:00"],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: "2026-11-01",
    endDate: null,
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}

export function makeLog(over: Partial<DoseLog> & Pick<DoseLog, "itemId" | "scheduledAt">): DoseLog {
  return {
    id: `${over.itemId}_${over.scheduledAt}`,
    status: "taken",
    reason: null,
    note: null,
    loggedBy: "m-elder",
    loggedAt: over.scheduledAt,
    ...over,
  };
}

export function makeMember(over: Partial<Member> = {}): Member {
  return {
    id: "m-elder",
    name: "Kamla Devi",
    role: "elder",
    email: null,
    passcodeHash: "",
    salt: "",
    access: "edit",
    isOrganiser: true,
    alerts: { missed: true, appointments: true },
    prefs: { textSize: "normal", lang: "en" },
    createdAt: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}

export function makeCircle(over: Partial<Circle> = {}): Circle {
  return {
    code: "ACDEFGHJ",
    elderName: "Kamla Devi",
    timezone: "Asia/Kolkata",
    approvalRequired: false,
    isDemo: false,
    expiresAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    profile: {
      conditions: [],
      allergies: [],
      bloodGroup: "",
      primaryDoctor: "",
      emergencyContact: { name: "", phone: "" },
    },
    login: { failures: 0, lockedUntil: null },
    quota: { aiDay: "", aiCount: 0, mailDay: "", mailCount: 0 },
    ...over,
  };
}

/** Narrows a value a test expects to exist, failing the test with a clear message otherwise. */
export function present<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} to be present`);
  return value;
}
