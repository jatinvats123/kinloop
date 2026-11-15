// Core domain types shared by every layer. Instants are ISO-8601 UTC strings; calendar dates are
// `YYYY-MM-DD` in the circle's timezone; times of day are `HH:mm` in the circle's timezone.

export type Role = "elder" | "family" | "caretaker";
export type Access = "view" | "edit";
export type ItemKind = "medicine" | "routine";
export type LogStatus = "taken" | "skipped";
export type SlotStatus = "taken" | "skipped" | "missed" | "due" | "upcoming";
export type TextSize = "normal" | "large" | "larger";

export const SKIP_REASONS = ["felt-unwell", "ran-out", "doctor-stopped", "other"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

/** Skip reasons the circle and the visit brief must hear about. */
export const FLAGGED_REASONS: ReadonlySet<SkipReason> = new Set(["felt-unwell", "ran-out"]);

export interface HealthProfile {
  conditions: string[];
  allergies: string[];
  bloodGroup: string;
  primaryDoctor: string;
  emergencyContact: { name: string; phone: string };
}

export interface Circle {
  code: string;
  elderName: string;
  timezone: string;
  approvalRequired: boolean;
  isDemo: boolean;
  expiresAt: string | null;
  createdAt: string;
  profile: HealthProfile;
  login: { failures: number; lockedUntil: string | null };
  quota: { aiDay: string; aiCount: number; mailDay: string; mailCount: number };
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  email: string | null;
  passcodeHash: string;
  salt: string;
  access: Access;
  isOrganiser: boolean;
  alerts: { missed: boolean; appointments: boolean };
  prefs: { textSize: TextSize; lang: "en" };
  createdAt: string;
}

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  composition: string | null;
  dose: string | null;
  instructions: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate: string | null;
  active: boolean;
  createdAt: string;
}

export interface DoseLog {
  id: string;
  itemId: string;
  scheduledAt: string;
  status: LogStatus;
  reason: SkipReason | null;
  note: string | null;
  loggedBy: string;
  loggedAt: string;
}

export interface Appointment {
  id: string;
  doctor: string;
  specialty: string;
  location: string;
  at: string;
  notes: string;
}

export interface ActivityEntry {
  id: string;
  actorId: string;
  actor: string;
  action: string;
  summary: string;
  at: string;
}

/** One scheduled occurrence of an item, derived on demand and never stored. */
export interface Slot {
  itemId: string;
  at: string;
  date: string;
  time: string;
}
