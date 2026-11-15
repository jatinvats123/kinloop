// Schedule engine: derives dose and routine slots from items for a date range in the circle's
// timezone. Slots are never stored; logs reference them by a deterministic ID.
import type { DoseLog, Item, Slot } from "./types";
import { dateRange, weekdayOf, zonedToUtc } from "./time";

/** True when `item` is scheduled on calendar `date` (active, within dates, on that weekday). */
export function isScheduledOn(item: Item, date: string): boolean {
  if (!item.active) return false;
  if (date < item.startDate) return false;
  if (item.endDate && date > item.endDate) return false;
  return item.daysOfWeek.includes(weekdayOf(date));
}

/**
 * All slots of `items` between `from` and `to` (inclusive calendar dates in `zone`),
 * sorted by instant, then by item name order of input.
 */
export function slotsForRange(
  items: readonly Item[],
  from: string,
  to: string,
  zone: string,
): Slot[] {
  const slots: Slot[] = [];
  for (const date of dateRange(from, to)) {
    for (const item of items) {
      if (!isScheduledOn(item, date)) continue;
      for (const time of item.times) {
        slots.push({ itemId: item.id, date, time, at: zonedToUtc(date, time, zone).toISOString() });
      }
    }
  }
  return slots.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Deterministic log ID for an item's slot, which makes logging idempotent. */
export function logId(itemId: string, slotAt: string): string {
  return `${itemId}_${slotAt}`;
}

/** Indexes logs by their slot key for O(1) lookups. */
export function indexLogs(logs: readonly DoseLog[]): Map<string, DoseLog> {
  return new Map(logs.map((l) => [logId(l.itemId, l.scheduledAt), l]));
}

export interface SlotGroup {
  time: string;
  at: string;
  slots: Slot[];
}

/** Groups slots of a single day by time of day (one card per time on Today). */
export function groupByTime(slots: readonly Slot[]): SlotGroup[] {
  const groups = new Map<string, SlotGroup>();
  for (const s of slots) {
    const key = `${s.date} ${s.time}`;
    const g = groups.get(key) ?? { time: s.time, at: s.at, slots: [] };
    g.slots.push(s);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** Normalises a list of `HH:mm` strings: trimmed, de-duplicated, sorted. */
export function normaliseTimes(times: readonly string[]): string[] {
  return [...new Set(times.map((t) => t.trim()))].sort();
}
