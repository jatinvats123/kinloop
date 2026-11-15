// Instant demo: an isolated circle for Kamla Devi with her daughter Priya and caretaker Ramesh,
// ten days of history (a visible missed-evening pattern and one "felt unwell" skip), a slot due
// soon and an appointment tomorrow. Demo circles expire after 24 hours.
import { demo } from "@/domain/config";
import { formatCircleCode } from "@/domain/codes";
import { logId, slotsForRange } from "@/domain/schedule";
import { addDays, todayIn, zonedParts, zonedToUtc } from "@/domain/time";
import type { ActivityEntry, Appointment, DoseLog, Item, Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import { newCircleCode, newId } from "@/server/auth/passcode";
import type { Repository } from "@/server/repositories/repository";
import { newCircleRecord, newMemberRecord } from "./circles";

const ZONE = "Asia/Kolkata";
const HISTORY_DAYS = 10;

/** Next quarter hour at least 15 minutes from now, as local HH:mm (so a slot is always due soon). */
export function dueSoonTime(now: Date, zone: string): string {
  const { time } = zonedParts(now, zone);
  const [h = 0, m = 0] = time.split(":").map(Number);
  const total = Math.min(Math.ceil((h * 60 + m + 15) / 15) * 15, 23 * 60 + 45);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function demoItems(today: string, now: Date, createdAt: string): Item[] {
  const start = addDays(today, -HISTORY_DAYS);
  const base = {
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: start,
    endDate: null,
    active: true,
    createdAt,
  };
  return [
    {
      ...base,
      id: "metformin",
      kind: "medicine",
      name: "Metformin",
      composition: "Metformin hydrochloride",
      dose: "500 mg",
      instructions: "After breakfast and after dinner",
      times: ["08:00", "20:00"],
    },
    {
      ...base,
      id: "amlodipine",
      kind: "medicine",
      name: "Amlodipine",
      composition: "Amlodipine besylate",
      dose: "5 mg",
      instructions: "One tablet with water",
      times: ["08:00"],
    },
    {
      ...base,
      id: "thyronorm",
      kind: "medicine",
      name: "Thyronorm",
      composition: "Levothyroxine sodium",
      dose: "50 mcg",
      instructions: "Empty stomach, 30 minutes before tea",
      times: ["06:30"],
    },
    {
      ...base,
      id: "atorvastatin",
      kind: "medicine",
      name: "Atorvastatin",
      composition: "Atorvastatin calcium",
      dose: "10 mg",
      instructions: "At bedtime",
      times: ["21:00"],
    },
    {
      ...base,
      id: "bp-check",
      kind: "routine",
      name: "Check blood pressure",
      composition: null,
      dose: null,
      instructions: "Sit for five minutes first, then note the reading",
      times: [dueSoonTime(now, ZONE)],
    },
  ];
}

/** Ten days of history: evenings missed on four days, one "felt unwell" skip, mornings mostly taken. */
function demoLogs(
  items: Item[],
  today: string,
  now: Date,
  ids: { elder: string; priya: string },
): DoseLog[] {
  const slots = slotsForRange(items, addDays(today, -HISTORY_DAYS), today, ZONE);
  const missedEvenings = new Set([1, 3, 4, 7].map((d) => addDays(today, -d)));
  const unwellDay = addDays(today, -2);
  const logs: DoseLog[] = [];
  slots.forEach((s, i) => {
    if (Date.parse(s.at) > now.getTime() - 30 * 60_000) return; // leave the current and future slots open
    const evening = Number(s.time.slice(0, 2)) >= 20;
    if (s.itemId === "metformin" && s.time === "20:00" && s.date === unwellDay) {
      logs.push({
        id: logId(s.itemId, s.at),
        itemId: s.itemId,
        scheduledAt: s.at,
        status: "skipped",
        reason: "felt-unwell",
        note: "Dizzy after dinner",
        loggedBy: ids.elder,
        loggedAt: new Date(Date.parse(s.at) + 25 * 60_000).toISOString(),
      });
      return;
    }
    if (evening && missedEvenings.has(s.date)) return;
    if (s.itemId === "thyronorm" && s.date === addDays(today, -6)) return;
    const reading = s.itemId === "bp-check" ? `${128 + (i % 9)}/${80 + (i % 5)}` : null;
    logs.push({
      id: logId(s.itemId, s.at),
      itemId: s.itemId,
      scheduledAt: s.at,
      status: "taken",
      reason: null,
      note: reading,
      loggedBy: i % 5 === 0 ? ids.priya : ids.elder,
      loggedAt: new Date(Date.parse(s.at) + (4 + (i % 14)) * 60_000).toISOString(),
    });
  });
  return logs;
}

export interface DemoCircle {
  code: string;
  elderId: string;
}

/** Creates a fresh, isolated demo circle and returns its code and the elder's member ID. */
export async function createDemoCircle(repo: Repository, now: Date): Promise<DemoCircle> {
  const createdAt = now.toISOString();
  const today = todayIn(ZONE, now);
  const alerts = { missed: true, appointments: true };
  const kamla = await newMemberRecord(
    { name: "Kamla Devi", role: "elder", email: null, access: "edit", isOrganiser: true, alerts },
    now,
  );
  const priya = await newMemberRecord(
    { name: "Priya", role: "family", email: null, access: "edit", isOrganiser: true, alerts },
    now,
  );
  const ramesh = await newMemberRecord(
    {
      name: "Ramesh",
      role: "caretaker",
      email: null,
      access: "view",
      isOrganiser: false,
      alerts: { missed: true, appointments: false },
    },
    now,
  );
  const members: Member[] = [kamla.member, priya.member, ramesh.member];
  const items = demoItems(today, now, createdAt);
  const logs = demoLogs(items, today, now, { elder: kamla.member.id, priya: priya.member.id });
  const appointments: Appointment[] = [
    {
      id: newId(),
      doctor: "Dr. Anjali Mehra",
      specialty: "Cardiology",
      location: "Max Hospital, Saket, New Delhi",
      at: zonedToUtc(addDays(today, 1), "11:00", ZONE).toISOString(),
      notes: "Bring the last three blood pressure readings and the lipid report.",
    },
    {
      id: newId(),
      doctor: "Dr. Suresh Iyer",
      specialty: "Endocrinology",
      location: "Fortis, Vasant Kunj",
      at: zonedToUtc(addDays(today, 9), "16:30", ZONE).toISOString(),
      notes: "Three-monthly HbA1c review.",
    },
  ];
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const activity: ActivityEntry[] = [
    {
      id: `a1-${newId()}`,
      actorId: priya.member.id,
      actor: "Priya",
      action: "appointment.added",
      summary: "Added an appointment with Dr. Anjali Mehra for tomorrow, 11:00 AM",
      at: at(180),
    },
    {
      id: `a2-${newId()}`,
      actorId: kamla.member.id,
      actor: "Kamla Devi",
      action: "dose.skipped",
      summary: "Skipped Metformin 500 mg at 8:00 PM: Felt unwell (Dizzy after dinner)",
      at: at(60 * 24 * 2 - 30),
    },
    {
      id: `a3-${newId()}`,
      actorId: priya.member.id,
      actor: "Priya",
      action: "item.added",
      summary: "Added routine Check blood pressure",
      at: at(60 * 24 * 10),
    },
    {
      id: `a4-${newId()}`,
      actorId: priya.member.id,
      actor: "Priya",
      action: "circle.created",
      summary: "Created the care circle for Kamla Devi",
      at: at(60 * 24 * 10 + 5),
    },
  ];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCircleCode();
    const circle = {
      ...newCircleRecord(code, "Kamla Devi", ZONE, now),
      isDemo: true,
      expiresAt: new Date(now.getTime() + demo.ttlHours * 3600_000).toISOString(),
      profile: {
        conditions: ["Type 2 diabetes", "High blood pressure", "Hypothyroidism"],
        allergies: ["Penicillin", "Sulfa drugs"],
        bloodGroup: "B+",
        primaryDoctor: "Dr. Anjali Mehra",
        emergencyContact: { name: "Priya (daughter)", phone: "+91 98110 42736" },
      },
      demoAccess: {
        code: formatCircleCode(code),
        [kamla.member.id]: kamla.passcode,
        [priya.member.id]: priya.passcode,
        [ramesh.member.id]: ramesh.passcode,
      },
    };
    if (await repo.createCircle({ circle, members, items, logs, appointments, activity })) {
      return { code, elderId: kamla.member.id };
    }
  }
  throw new AppError("unavailable", "Couldn't start a demo right now. Please try again.");
}

/** Deletes expired demo circles; called from the cron tick. Returns how many were removed. */
export async function purgeExpiredDemos(repo: Repository, now: Date, limit = 20): Promise<number> {
  const codes = await repo.listExpiredDemoCircles(now.toISOString(), limit);
  for (const code of codes) await repo.deleteCircle(code);
  return codes.length;
}
