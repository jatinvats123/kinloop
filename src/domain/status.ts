// Slot and slot-group status: taken, skipped, missed, due or upcoming, computed from logs and the clock.
import { DUE_LEAD_MIN, MINUTE_MS, MISSED_AFTER_MIN } from "./config";
import type { DoseLog, Slot, SlotStatus } from "./types";

/** True when the slot's missed threshold (slot time + 60 min) has passed. */
export function isPastMissedThreshold(slotAt: string, now: Date): boolean {
  return now.getTime() >= Date.parse(slotAt) + MISSED_AFTER_MIN * MINUTE_MS;
}

/** Status of a single slot given its log (if any) and the current time. */
export function slotStatus(
  slot: Pick<Slot, "at">,
  log: DoseLog | undefined,
  now: Date,
): SlotStatus {
  if (log) return log.status;
  if (isPastMissedThreshold(slot.at, now)) return "missed";
  if (now.getTime() >= Date.parse(slot.at) - DUE_LEAD_MIN * MINUTE_MS) return "due";
  return "upcoming";
}

/**
 * Status of a group of items sharing a time: settled when every item is logged (taken if any
 * was taken), otherwise missed, due or upcoming by the clock.
 */
export function groupStatus(statuses: readonly SlotStatus[]): SlotStatus {
  if (statuses.length === 0) return "upcoming";
  const settled = statuses.every((s) => s === "taken" || s === "skipped");
  if (settled) return statuses.includes("taken") ? "taken" : "skipped";
  if (statuses.includes("missed")) return "missed";
  if (statuses.includes("due")) return "due";
  return "upcoming";
}
