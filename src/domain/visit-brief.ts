// Visit brief facts: everything a doctor's visit needs, computed by tested code from the schedule,
// logs and health profile. The AI only drafts talking points from these facts; it never adds facts.
import { computeAdherence } from "./adherence";
import { indexLogs, logId, slotsForRange } from "./schedule";
import { isPastMissedThreshold } from "./status";
import { addDays, to12h, todayIn, zonedParts } from "./time";
import type { Appointment, Circle, DoseLog, Item, SkipReason } from "./types";

/** How many days of history the brief summarises. */
export const BRIEF_DAYS = 30;
/** At most this many skip, missed-dose and reading rows are listed. */
export const BRIEF_ROW_LIMIT = 10;

const REASON_LABEL: Record<SkipReason, string> = {
  "felt-unwell": "Felt unwell",
  "ran-out": "Ran out",
  "doctor-stopped": "Doctor said to stop",
  other: "Other",
};

export interface BriefFacts {
  appointment: { doctor: string; specialty: string; location: string; at: string };
  profile: { conditions: string[]; allergies: string[]; bloodGroup: string; primaryDoctor: string };
  adherence: {
    days: number;
    percent30: number | null;
    percent7: number | null;
    taken: number;
    skipped: number;
    missed: number;
    streakDays: number;
    mostMissedPart: string | null;
  };
  perItem: Array<{ name: string; percent: number | null; missed: number; skipped: number }>;
  /** Most recent first. */
  skips: Array<{ date: string; time: string; item: string; reason: string }>;
  /** Most recent first. */
  missed: Array<{ date: string; time: string; item: string }>;
  /** Readings noted when a routine (or medicine) was logged, most recent first. */
  readings: Array<{ date: string; item: string; note: string }>;
  schedule: Array<{
    kind: Item["kind"];
    name: string;
    composition: string | null;
    dose: string | null;
    times: string[];
    instructions: string;
    paused: boolean;
  }>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-13" → "13 Nov". */
export function shortDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ""}`;
}

const label = (item: Item | undefined) =>
  item ? (item.dose ? `${item.name} ${item.dose}` : item.name) : "A removed item";

/**
 * Computes the facts for a visit brief: 30- and 7-day adherence, per-item adherence, recent skips
 * with reasons, recent missed doses, noted readings, the current schedule and the health profile.
 * `logs` should cover at least the last 30 days in the circle's zone.
 */
export function buildVisitBriefFacts(input: {
  circle: Pick<Circle, "timezone" | "profile">;
  appointment: Appointment;
  items: readonly Item[];
  logs: readonly DoseLog[];
  now: Date;
}): BriefFacts {
  const { circle, appointment, items, logs, now } = input;
  const zone = circle.timezone;
  const today = todayIn(zone, now);
  const a30 = computeAdherence(items, logs, today, BRIEF_DAYS, now, zone);
  const a7 = computeAdherence(items, logs, today, 7, now, zone);
  const byId = new Map(items.map((i) => [i.id, i]));
  const recentFirst = [...logs].sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));
  const when = (iso: string) => {
    const p = zonedParts(iso, zone);
    return { date: shortDate(p.date), time: to12h(p.time).label };
  };

  const byKey = indexLogs(logs);
  const missed = slotsForRange(items, addDays(today, -(BRIEF_DAYS - 1)), today, zone)
    .filter((s) => !byKey.has(logId(s.itemId, s.at)) && isPastMissedThreshold(s.at, now))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, BRIEF_ROW_LIMIT)
    .map((s) => ({ ...when(s.at), item: label(byId.get(s.itemId)) }));

  return {
    appointment: {
      doctor: appointment.doctor,
      specialty: appointment.specialty,
      location: appointment.location,
      at: appointment.at,
    },
    profile: {
      conditions: [...circle.profile.conditions],
      allergies: [...circle.profile.allergies],
      bloodGroup: circle.profile.bloodGroup,
      primaryDoctor: circle.profile.primaryDoctor,
    },
    adherence: {
      days: BRIEF_DAYS,
      percent30: a30.overall.percent,
      percent7: a7.overall.percent,
      taken: a30.overall.taken,
      skipped: a30.overall.skipped,
      missed: a30.overall.missed,
      streakDays: a30.streakDays,
      mostMissedPart: a30.mostMissedPart?.part ?? null,
    },
    perItem: a30.perItem.map((p) => ({
      name: label(byId.get(p.itemId)),
      percent: p.percent,
      missed: p.missed,
      skipped: p.skipped,
    })),
    skips: recentFirst
      .filter((l) => l.status === "skipped")
      .slice(0, BRIEF_ROW_LIMIT)
      .map((l) => ({
        ...when(l.scheduledAt),
        item: label(byId.get(l.itemId)),
        reason: l.reason ? REASON_LABEL[l.reason] : "No reason given",
      })),
    missed,
    readings: recentFirst
      .filter((l) => l.note)
      .slice(0, BRIEF_ROW_LIMIT)
      .map((l) => ({
        date: when(l.scheduledAt).date,
        item: label(byId.get(l.itemId)),
        note: l.note as string,
      })),
    schedule: items.map((i) => ({
      kind: i.kind,
      name: i.name,
      composition: i.composition,
      dose: i.dose,
      times: [...i.times].sort().map((t) => to12h(t).label),
      instructions: i.instructions,
      paused: !i.active,
    })),
  };
}

/**
 * Renders the facts as plain text for the AI. Names, phone numbers and emails are left out: the
 * model sees only the clinical facts it needs to draft talking points.
 */
export function briefFactsText(f: BriefFacts): string {
  const list = (xs: string[]) => (xs.length ? xs.join("; ") : "none recorded");
  const pct = (p: number | null) => (p === null ? "not enough data" : `${p}%`);
  const lines = [
    `Visit: ${f.appointment.specialty || "doctor"} appointment.`,
    `Conditions: ${list(f.profile.conditions)}. Allergies: ${list(f.profile.allergies)}.`,
    `Adherence over ${f.adherence.days} days: ${pct(f.adherence.percent30)} taken`,
    `(${f.adherence.taken} taken, ${f.adherence.skipped} skipped, ${f.adherence.missed} missed);`,
    `last 7 days: ${pct(f.adherence.percent7)}.`,
    f.adherence.mostMissedPart ? `Most often missed in the ${f.adherence.mostMissedPart}.` : "",
    "Per item:",
    ...f.perItem.map(
      (p) => `- ${p.name}: ${pct(p.percent)} taken, ${p.missed} missed, ${p.skipped} skipped`,
    ),
    "Skipped doses (most recent first):",
    ...(f.skips.length
      ? f.skips.map((s) => `- ${s.date} ${s.time} ${s.item}: ${s.reason}`)
      : ["- none"]),
    "Readings noted:",
    ...(f.readings.length ? f.readings.map((r) => `- ${r.date} ${r.item}: ${r.note}`) : ["- none"]),
    "Current schedule:",
    ...f.schedule.map(
      (s) =>
        `- ${s.kind} ${s.name}${s.dose ? ` ${s.dose}` : ""} at ${s.times.join(", ")}${s.paused ? " (paused)" : ""}${s.instructions ? `; ${s.instructions}` : ""}`,
    ),
  ];
  return lines.filter(Boolean).join("\n");
}
