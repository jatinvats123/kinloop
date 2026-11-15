// Timezone-aware calendar helpers built on Intl only. Dates are `YYYY-MM-DD`, times `HH:mm`,
// instants are UTC `Date`s or ISO strings.

const MINUTE = 60_000;
export const DAY_MS = 24 * 60 * MINUTE;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(zone, f);
  }
  return f;
}

/** True when `zone` is an IANA timezone this runtime understands. */
export function isValidTimeZone(zone: string): boolean {
  try {
    formatter(zone);
    return true;
  } catch {
    return false;
  }
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parts(instant: number, zone: string): Parts {
  const out: Record<string, number> = {};
  for (const p of formatter(zone).formatToParts(new Date(instant))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year ?? 0,
    month: out.month ?? 0,
    day: out.day ?? 0,
    hour: out.hour ?? 0,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Minutes the zone is ahead of UTC at `instant` (e.g. +330 for Asia/Kolkata). */
export function zoneOffsetMinutes(instant: number, zone: string): number {
  const p = parts(instant, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / MINUTE);
}

/** Calendar date, time of day and weekday (0 = Sunday) of `instant` in `zone`. */
export function zonedParts(
  instant: Date | string,
  zone: string,
): { date: string; time: string; weekday: number } {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  const p = parts(ms, zone);
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return { date, time: `${pad(p.hour)}:${pad(p.minute)}`, weekday: weekdayOf(date) };
}

/** The UTC instant of wall-clock `time` on `date` in `zone` (handles DST shifts). */
export function zonedToUtc(date: string, time: string, zone: string): Date {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - zoneOffsetMinutes(guess, zone) * MINUTE;
  const second = guess - zoneOffsetMinutes(first, zone) * MINUTE;
  return new Date(second);
}

/** Weekday (0 = Sunday) of a calendar date, independent of timezone. */
export function weekdayOf(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Adds `n` calendar days to a `YYYY-MM-DD` date. */
export function addDays(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Every date from `from` to `to` inclusive (empty when `to` is before `from`). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Today's calendar date in `zone`. */
export function todayIn(zone: string, now: Date): string {
  return zonedParts(now, zone).date;
}

/** Splits `HH:mm` into a 12-hour clock string and meridiem: "20:05" → { time: "8:05", meridiem: "PM" }. */
export function to12h(time: string): { time: string; meridiem: "AM" | "PM"; label: string } {
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const meridiem = hh < 12 ? "AM" : "PM";
  const h = hh % 12 === 0 ? 12 : hh % 12;
  const t = `${h}:${pad(mm)}`;
  return { time: t, meridiem, label: `${t} ${meridiem}` };
}

/** 12-hour clock label of an instant in `zone`, e.g. "8:05 AM". */
export function clockLabel(instant: Date | string, zone: string): string {
  return to12h(zonedParts(instant, zone).time).label;
}

/** Part of the day for a `HH:mm` time, used to describe patterns in plain words. */
export function dayPart(time: string): "morning" | "afternoon" | "evening" | "night" {
  const hh = Number(time.slice(0, 2));
  if (hh >= 5 && hh < 12) return "morning";
  if (hh >= 12 && hh < 17) return "afternoon";
  if (hh >= 17 && hh < 21) return "evening";
  return "night";
}

/** Greeting key for the hour of day in the circle's zone. */
export function greetingPart(now: Date, zone: string): "morning" | "afternoon" | "evening" {
  const hh = Number(zonedParts(now, zone).time.slice(0, 2));
  if (hh >= 4 && hh < 12) return "morning";
  if (hh >= 12 && hh < 17) return "afternoon";
  return "evening";
}

/** Long human date in `zone`, e.g. "Saturday, 14 November". */
export function longDate(instant: Date | string, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(typeof instant === "string" ? new Date(instant) : instant);
}

/** Short weekday label for a calendar date, e.g. "Sa". */
export function shortWeekday(date: string): string {
  return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][weekdayOf(date)] ?? "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-13" → "13 Nov". */
export function shortDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ""}`;
}
