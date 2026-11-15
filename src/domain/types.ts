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
  /** True when any member has an email, so the cron tick only visits circles that can receive mail. */
  mailEnabled?: boolean;
  /** Demo circles only: sign-in details shown on the demo panel (fictional people, no real data). */
  demoAccess?: Record<string, string>;
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

/** One day in the week strip: how many slots were scheduled and how many were settled. */
export interface WeekDay {
  date: string;
  weekday: string;
  day: number;
  total: number;
  done: number;
  isToday: boolean;
}

/** What a sent (or claimed) reminder email was about: a ladder stage or a test message. */
export type NotificationType =
  "due" | "missed-elder" | "missed-circle" | "appt-24h" | "appt-2h" | "test";

/** A reminder email that was claimed and sent; the ID makes each email go out at most once. */
export interface Notification {
  id: string;
  type: NotificationType;
  to: string;
  /** The slot or appointment instant the email is about. */
  at: string;
  sentAt: string;
  itemCount: number;
}

/** "I'll check on her": the first member who took on a missed slot. */
export interface FollowUp {
  slotAt: string;
  memberId: string;
  memberName: string;
  at: string;
}

export type ProposalKind = "add" | "update" | "remove";
export type ProposalStatus = "pending" | "approved" | "declined";

/** Schedule fields a proposal carries; the same shape the item form saves. */
export interface ItemDraft {
  kind: ItemKind;
  name: string;
  composition: string | null;
  dose: string | null;
  instructions: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate: string | null;
}

/** "Ask me first": a schedule change by another member, waiting for the elder's decision. */
export interface Proposal {
  id: string;
  kind: ProposalKind;
  itemId: string | null;
  /** Item fields; `active` is set for pause and resume. */
  payload: (ItemDraft & { active?: boolean }) | null;
  summary: string;
  proposedBy: string;
  proposedByName: string;
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
}
