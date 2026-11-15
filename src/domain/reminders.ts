// Reminder engine: decides which reminder emails are due right now from the schedule, logs,
// appointments and the notifications already sent. Pure and window-based, so a late or repeated
// cron tick sends each email at most once.
import { MINUTE_MS, reminderLadder } from "./config";
import { slotsForRange } from "./schedule";
import { addDays, todayIn } from "./time";
import type { Appointment, Circle, DoseLog, Item, Member } from "./types";

export type SlotStage = "due" | "missed-elder" | "missed-circle";
export type AppointmentStage = "appt-24h" | "appt-2h";
export type ReminderStage = SlotStage | AppointmentStage;

/** One email to one member. `key` is the notification document ID used to claim it. */
export interface PlannedReminder {
  key: string;
  stage: ReminderStage;
  memberId: string;
  /** The slot instant (dose stages) or the appointment instant (appointment stages). */
  at: string;
  /** Items still waiting in the slot; empty for appointments. */
  itemIds: string[];
  appointmentId: string | null;
}

/** A reminder that will be sent later today if nothing changes, for the reminders log. */
export interface UpcomingReminder {
  stage: ReminderStage;
  sendAt: string;
  at: string;
  memberIds: string[];
  itemIds: string[];
  appointmentId: string | null;
}

export interface ReminderInput {
  circle: Pick<Circle, "timezone">;
  members: readonly Member[];
  items: readonly Item[];
  logs: readonly DoseLog[];
  appointments: readonly Appointment[];
  sentKeys: ReadonlySet<string>;
  now: Date;
}

const L = reminderLadder;
const APPT_STAGES: ReadonlyArray<{ stage: AppointmentStage; leadMin: number }> = [
  { stage: "appt-24h", leadMin: L.appointmentLeadMin[0] },
  { stage: "appt-2h", leadMin: L.appointmentLeadMin[1] },
];

/** Notification document ID: one per instant, stage and member (safe as a Firestore doc ID). */
export function notificationKey(at: string, stage: ReminderStage, memberId: string): string {
  return `${at}_${stage}_${memberId}`;
}

const offset = (iso: string, min: number) => Date.parse(iso) + min * MINUTE_MS;

function elderOf(members: readonly Member[]): Member | undefined {
  return members.find((m) => m.role === "elder");
}

function emailable(m: Member | undefined): m is Member {
  return Boolean(m?.email);
}

/** Members (not the elder) who asked to hear about missed doses and have an email. */
export function circleRecipients(members: readonly Member[]): Member[] {
  return members.filter((m) => m.role !== "elder" && m.email && m.alerts.missed);
}

/** Members (elder included) who asked for appointment reminders and have an email. */
export function appointmentRecipients(members: readonly Member[]): Member[] {
  return members.filter((m) => m.email && m.alerts.appointments);
}

interface PendingSlot {
  at: string;
  itemIds: string[];
}

/**
 * Slots between `fromMs` and `toMs` that still have unlogged items, grouped by instant.
 * Slots before an item was created are ignored so a new item never triggers "missed" mail.
 */
function pendingSlots(input: ReminderInput, fromMs: number, toMs: number): PendingSlot[] {
  const { items, logs, circle, now } = input;
  const today = todayIn(circle.timezone, now);
  const logged = new Set(logs.map((l) => `${l.itemId}_${l.scheduledAt}`));
  const byAt = new Map<string, string[]>();
  for (const s of slotsForRange(items, addDays(today, -1), addDays(today, 1), circle.timezone)) {
    const t = Date.parse(s.at);
    if (t < fromMs || t > toMs) continue;
    const item = items.find((i) => i.id === s.itemId);
    if (!item || s.at < item.createdAt || logged.has(`${s.itemId}_${s.at}`)) continue;
    byAt.set(s.at, [...(byAt.get(s.at) ?? []), s.itemId]);
  }
  return [...byAt.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, itemIds]) => ({ at, itemIds }));
}

function planSlot(input: ReminderInput, slot: PendingSlot): PlannedReminder[] {
  const now = input.now.getTime();
  const elder = elderOf(input.members);
  const out: PlannedReminder[] = [];
  const push = (stage: SlotStage, member: Member) => {
    const key = notificationKey(slot.at, stage, member.id);
    if (input.sentKeys.has(key)) return;
    out.push({
      key,
      stage,
      memberId: member.id,
      at: slot.at,
      itemIds: slot.itemIds,
      appointmentId: null,
    });
  };

  // The elder hears first: the latest elder stage whose time has come (a late tick skips "due").
  if (emailable(elder) && now >= offset(slot.at, L.dueOffsetMin)) {
    push(now >= offset(slot.at, L.missedElderOffsetMin) ? "missed-elder" : "due", elder);
  }

  // The circle hears only after the elder's second nudge has gone out (or the elder has no email).
  const elderNudged =
    !emailable(elder) || input.sentKeys.has(notificationKey(slot.at, "missed-elder", elder.id));
  if (now >= offset(slot.at, L.missedCircleOffsetMin) && elderNudged) {
    for (const m of circleRecipients(input.members)) push("missed-circle", m);
  }
  return out;
}

/** The latest appointment stage whose window is open at `now`, if any. */
function openAppointmentStage(at: string, now: number): AppointmentStage | null {
  if (now >= Date.parse(at)) return null;
  let open: AppointmentStage | null = null;
  for (const { stage, leadMin } of APPT_STAGES) {
    if (now >= offset(at, -leadMin)) open = stage;
  }
  return open;
}

/**
 * Every reminder email that should go out at `input.now` and has not been sent yet:
 * - dose slots: `due` to the elder from T−10 min, `missed-elder` from T+30, then `missed-circle`
 *   to opted-in members from T+60 once the elder's nudge has gone out; slots older than 6 h and
 *   fully logged slots are ignored, and all pending items at one time share one email;
 * - appointments: 24 h and 2 h before, to members who opted in.
 */
export function planReminders(input: ReminderInput): PlannedReminder[] {
  const now = input.now.getTime();
  const slots = pendingSlots(
    input,
    now - L.ignoreOlderThanMin * MINUTE_MS,
    now - L.dueOffsetMin * MINUTE_MS,
  );
  const out = slots.flatMap((s) => planSlot(input, s));

  for (const appt of input.appointments) {
    const stage = openAppointmentStage(appt.at, now);
    if (!stage) continue;
    for (const m of appointmentRecipients(input.members)) {
      const key = notificationKey(appt.at, stage, m.id);
      if (input.sentKeys.has(key)) continue;
      out.push({ key, stage, memberId: m.id, at: appt.at, itemIds: [], appointmentId: appt.id });
    }
  }
  return out;
}

/**
 * Reminders that will be sent within `horizonMin` minutes if nothing is logged: the elder's `due`
 * email for each pending slot and each appointment stage still ahead.
 */
export function upcomingReminders(input: ReminderInput, horizonMin: number): UpcomingReminder[] {
  const now = input.now.getTime();
  const until = now + horizonMin * MINUTE_MS;
  const elder = elderOf(input.members);
  const out: UpcomingReminder[] = [];

  if (emailable(elder)) {
    for (const s of pendingSlots(input, now - L.dueOffsetMin * MINUTE_MS, until)) {
      const sendAt = offset(s.at, L.dueOffsetMin);
      if (sendAt <= now) continue;
      out.push({
        stage: "due",
        sendAt: new Date(sendAt).toISOString(),
        at: s.at,
        memberIds: [elder.id],
        itemIds: s.itemIds,
        appointmentId: null,
      });
    }
  }

  const apptTo = appointmentRecipients(input.members).map((m) => m.id);
  if (apptTo.length > 0) {
    for (const appt of input.appointments) {
      for (const { stage, leadMin } of APPT_STAGES) {
        const sendAt = offset(appt.at, -leadMin);
        if (sendAt <= now || sendAt > until) continue;
        out.push({
          stage,
          sendAt: new Date(sendAt).toISOString(),
          at: appt.at,
          memberIds: apptTo,
          itemIds: [],
          appointmentId: appt.id,
        });
      }
    }
  }
  return out.sort((a, b) => (a.sendAt < b.sendAt ? -1 : 1));
}
