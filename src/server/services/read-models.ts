// Read models for pages: Today (slot groups with statuses), the circle overview and adherence.
// One bounded query per collection; everything else is computed by tested domain functions.
import { computeAdherence, type AdherenceReport } from "@/domain/adherence";
import { groupByTime, indexLogs, logId, slotsForRange } from "@/domain/schedule";
import { groupStatus, slotStatus } from "@/domain/status";
import { addDays, shortWeekday, todayIn, zonedToUtc } from "@/domain/time";
import type {
  ActivityEntry,
  Appointment,
  Circle,
  DoseLog,
  Item,
  SlotStatus,
  WeekDay,
} from "@/domain/types";
import { FLAGGED_REASONS } from "@/domain/types";
import type { Repository } from "@/server/repositories/repository";

export interface TodayItem {
  item: Item;
  status: SlotStatus;
  log: DoseLog | undefined;
}

export interface TodayGroup {
  time: string;
  at: string;
  status: SlotStatus;
  items: TodayItem[];
}

export interface TodayView {
  date: string;
  groups: TodayGroup[];
  done: number;
  total: number;
  nextAppointment: Appointment | null;
}

function dayBoundsUtc(date: string, zone: string): { from: string; to: string } {
  return {
    from: zonedToUtc(date, "00:00", zone).toISOString(),
    to: new Date(zonedToUtc(addDays(date, 1), "00:00", zone).getTime() - 1).toISOString(),
  };
}

function buildGroups(
  items: Item[],
  logs: DoseLog[],
  date: string,
  circle: Circle,
  now: Date,
): TodayGroup[] {
  const byKey = indexLogs(logs);
  const itemsById = new Map(items.map((i) => [i.id, i]));
  return groupByTime(slotsForRange(items, date, date, circle.timezone)).map((g) => {
    const groupItems = g.slots.map((s) => {
      const log = byKey.get(logId(s.itemId, s.at));
      return { item: itemsById.get(s.itemId) as Item, log, status: slotStatus(s, log, now) };
    });
    return {
      time: g.time,
      at: g.at,
      items: groupItems,
      status: groupStatus(groupItems.map((i) => i.status)),
    };
  });
}

/** Today's schedule for the elder-first screen. */
export async function buildToday(repo: Repository, circle: Circle, now: Date): Promise<TodayView> {
  const date = todayIn(circle.timezone, now);
  const { from, to } = dayBoundsUtc(date, circle.timezone);
  const [items, logs, appts] = await Promise.all([
    repo.listItems(circle.code),
    repo.listLogs(circle.code, from, to),
    repo.listAppointments(circle.code, now.toISOString(), 1),
  ]);
  const groups = buildGroups(items, logs, date, circle, now);
  const all = groups.flatMap((g) => g.items);
  return {
    date,
    groups,
    total: all.length,
    done: all.filter((i) => i.status === "taken" || i.status === "skipped").length,
    nextAppointment: appts[0] ?? null,
  };
}

export interface FlaggedSkip {
  log: DoseLog;
  itemName: string;
}

export interface OverviewView {
  today: TodayView;
  week: WeekDay[];
  adherence7: AdherenceReport;
  adherence30: AdherenceReport;
  flagged: FlaggedSkip[];
  upcoming: Appointment[];
  activity: ActivityEntry[];
  items: Item[];
}

/** Everything the family and caretaker overview needs, from four bounded queries. */
export async function buildOverview(
  repo: Repository,
  circle: Circle,
  now: Date,
): Promise<OverviewView> {
  const zone = circle.timezone;
  const date = todayIn(zone, now);
  const from = dayBoundsUtc(addDays(date, -29), zone).from;
  const { from: todayFrom, to } = dayBoundsUtc(date, zone);
  const [items, logs, upcoming, activity] = await Promise.all([
    repo.listItems(circle.code),
    repo.listLogs(circle.code, from, to),
    repo.listAppointments(circle.code, now.toISOString(), 5),
    repo.listActivity(circle.code, 12),
  ]);
  const todayLogs = logs.filter((l) => l.scheduledAt >= todayFrom);
  const groups = buildGroups(items, todayLogs, date, circle, now);
  const all = groups.flatMap((g) => g.items);
  const today: TodayView = {
    date,
    groups,
    total: all.length,
    done: all.filter((i) => i.status === "taken" || i.status === "skipped").length,
    nextAppointment: upcoming[0] ?? null,
  };

  const adherence7 = computeAdherence(items, logs, date, 7, now, zone);
  const adherence30 = computeAdherence(items, logs, date, 30, now, zone);
  const week: WeekDay[] = adherence7.daily.map((d) => ({
    date: d.date,
    weekday: shortWeekday(d.date),
    day: Number(d.date.slice(8)),
    total: d.scheduled,
    done: d.date === date ? today.done : d.taken + d.skipped,
    isToday: d.date === date,
  }));
  const names = new Map(items.map((i) => [i.id, i.dose ? `${i.name} ${i.dose}` : i.name]));
  const flagged = logs
    .filter((l) => l.status === "skipped" && l.reason && FLAGGED_REASONS.has(l.reason))
    .filter((l) => l.scheduledAt >= dayBoundsUtc(addDays(date, -13), zone).from)
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1))
    .map((log) => ({ log, itemName: names.get(log.itemId) ?? "A removed item" }));

  return { today, week, adherence7, adherence30, flagged, upcoming, activity, items };
}
