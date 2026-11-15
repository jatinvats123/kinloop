// Adherence statistics: percentages overall and per item, daily series, streak and the part of the
// day most often missed. Only doses past their missed threshold, or already logged, are counted.
import { indexLogs, logId, slotsForRange } from "./schedule";
import { isPastMissedThreshold } from "./status";
import { addDays, dateRange, dayPart } from "./time";
import type { DoseLog, Item } from "./types";

export interface Tally {
  taken: number;
  skipped: number;
  missed: number;
  counted: number;
  /** Whole-number percentage, or null when nothing is countable yet. */
  percent: number | null;
}

export interface DayTally extends Tally {
  date: string;
  scheduled: number;
}

export interface AdherenceReport {
  overall: Tally;
  perItem: Array<{ itemId: string; name: string } & Tally>;
  daily: DayTally[];
  streakDays: number;
  mostMissedPart: { part: ReturnType<typeof dayPart>; count: number } | null;
}

function emptyTally(): Tally {
  return { taken: 0, skipped: 0, missed: 0, counted: 0, percent: null };
}

function finish(t: Tally): Tally {
  return { ...t, percent: t.counted === 0 ? null : Math.round((t.taken / t.counted) * 100) };
}

/**
 * Computes adherence for the `days` calendar days ending on `today` (inclusive) in `zone`.
 * Taken ÷ counted, where counted = logged doses + unlogged doses past the missed threshold.
 * Skipped counts as not taken and is reported separately.
 */
export function computeAdherence(
  items: readonly Item[],
  logs: readonly DoseLog[],
  today: string,
  days: number,
  now: Date,
  zone: string,
): AdherenceReport {
  const from = addDays(today, -(days - 1));
  const slots = slotsForRange(items, from, today, zone);
  const byKey = indexLogs(logs);
  const names = new Map(items.map((i) => [i.id, i.name]));

  const overall = emptyTally();
  const perItem = new Map<string, Tally>();
  const perDay = new Map<string, DayTally>(
    dateRange(from, today).map((d) => [d, { date: d, scheduled: 0, ...emptyTally() }]),
  );
  const missedByPart = new Map<ReturnType<typeof dayPart>, number>();

  for (const slot of slots) {
    const log = byKey.get(logId(slot.itemId, slot.at));
    const day = perDay.get(slot.date) as DayTally;
    day.scheduled += 1;
    const outcome = log ? log.status : isPastMissedThreshold(slot.at, now) ? "missed" : null;
    if (!outcome) continue;
    const item = perItem.get(slot.itemId) ?? emptyTally();
    for (const t of [overall, item, day]) {
      t.counted += 1;
      t[outcome] += 1;
    }
    perItem.set(slot.itemId, item);
    if (outcome !== "taken") {
      const part = dayPart(slot.time);
      missedByPart.set(part, (missedByPart.get(part) ?? 0) + 1);
    }
  }

  const daily = [...perDay.values()].map((d) => ({ ...d, ...finish(d) }));
  let mostMissedPart: AdherenceReport["mostMissedPart"] = null;
  for (const [part, count] of missedByPart) {
    if (!mostMissedPart || count > mostMissedPart.count) mostMissedPart = { part, count };
  }

  return {
    overall: finish(overall),
    perItem: items
      .filter((i) => perItem.has(i.id))
      .map((i) => ({
        itemId: i.id,
        name: names.get(i.id) ?? i.id,
        ...finish(perItem.get(i.id) as Tally),
      })),
    daily,
    streakDays: streak(daily),
    mostMissedPart,
  };
}

/**
 * Consecutive days, counting back from today, on which every counted dose was taken. Days with
 * nothing counted yet (including a today still in progress) neither add to nor break the streak.
 */
export function streak(daily: readonly DayTally[]): number {
  let n = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    const d = daily[i] as DayTally;
    if (d.counted === 0) continue;
    if (d.taken !== d.counted) break;
    n += 1;
  }
  return n;
}
