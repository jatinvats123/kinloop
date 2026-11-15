// Logging doses and routines: take a whole slot, skip one item with a reason, or undo a log.
// Log IDs are deterministic (item + slot), so repeating an action never creates duplicates.
import { logId, slotsForRange } from "@/domain/schedule";
import { addDays, clockLabel } from "@/domain/time";
import type { DoseLog, Item } from "@/domain/types";
import { AppError } from "@/server/errors";
import { skipSchema, takeSchema } from "@/server/validation";
import { t } from "@/domain/messages";
import { describeItem } from "./items";
import { parseInput, recordActivity, requirePermission, type Ctx } from "./context";

const MAX_PAST_DAYS = 7;
const MAX_FUTURE_MS = 12 * 3600_000;

/** Checks that `itemId` really has a slot at `slotAt` and that the slot is a sensible one to log. */
async function scheduledItem(
  ctx: Ctx,
  items: Item[],
  itemId: string,
  slotAt: string,
): Promise<Item> {
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new AppError("not-found", "That item no longer exists.");
  const at = Date.parse(slotAt);
  if (
    at > ctx.now.getTime() + MAX_FUTURE_MS ||
    at < ctx.now.getTime() - MAX_PAST_DAYS * 86_400_000
  ) {
    throw new AppError("bad-request", "That time can't be logged.");
  }
  const day = new Date(at).toISOString().slice(0, 10);
  const slots = slotsForRange([item], addDays(day, -1), addDays(day, 1), ctx.circle.timezone);
  if (!slots.some((s) => s.at === new Date(at).toISOString())) {
    throw new AppError("bad-request", "That item isn't scheduled at that time.");
  }
  return item;
}

/**
 * Marks every listed item in a slot as taken (or done, for routines). Already-taken items are left
 * untouched; optional routine readings are stored as notes.
 */
export async function takeSlot(
  ctx: Ctx,
  input: unknown,
  readings: Record<string, string> = {},
): Promise<number> {
  requirePermission(ctx, "log-dose");
  const d = parseInput(takeSchema, input);
  const slotAt = new Date(d.slotAt).toISOString();
  const [items, existing] = await Promise.all([
    ctx.repo.listItems(ctx.circle.code),
    ctx.repo.listLogs(ctx.circle.code, slotAt, slotAt),
  ]);
  const taken = new Set(existing.filter((l) => l.status === "taken").map((l) => l.itemId));

  const logs: DoseLog[] = [];
  const names: string[] = [];
  for (const itemId of new Set(d.itemIds)) {
    const item = await scheduledItem(ctx, items, itemId, slotAt);
    if (taken.has(itemId)) continue;
    const reading = readings[itemId]?.trim().slice(0, 60) || null;
    logs.push({
      id: logId(itemId, slotAt),
      itemId,
      scheduledAt: slotAt,
      status: "taken",
      reason: null,
      note: item.kind === "routine" ? reading : null,
      loggedBy: ctx.member.id,
      loggedAt: ctx.now.toISOString(),
    });
    names.push(
      reading && item.kind === "routine"
        ? `${describeItem(item)} (${reading})`
        : describeItem(item),
    );
  }
  if (logs.length === 0) return 0;
  await ctx.repo.putLogs(ctx.circle.code, logs);
  const slotLabel = clockLabel(slotAt, ctx.circle.timezone);
  await recordActivity(ctx, "dose.taken", `Marked ${slotLabel} as taken: ${names.join(", ")}`);
  return logs.length;
}

/** Skips one item in a slot with a reason from the fixed list. "Felt unwell" and "ran out" are flagged. */
export async function skipItem(ctx: Ctx, input: unknown): Promise<void> {
  requirePermission(ctx, "log-dose");
  const d = parseInput(skipSchema, input);
  const slotAt = new Date(d.slotAt).toISOString();
  const items = await ctx.repo.listItems(ctx.circle.code);
  const item = await scheduledItem(ctx, items, d.itemId, slotAt);
  await ctx.repo.putLogs(ctx.circle.code, [
    {
      id: logId(item.id, slotAt),
      itemId: item.id,
      scheduledAt: slotAt,
      status: "skipped",
      reason: d.reason,
      note: d.note,
      loggedBy: ctx.member.id,
      loggedAt: ctx.now.toISOString(),
    },
  ]);
  await recordActivity(
    ctx,
    "dose.skipped",
    `Skipped ${describeItem(item)} at ${clockLabel(slotAt, ctx.circle.timezone)}: ${t(`skip.${d.reason}`)}${d.note ? ` (${d.note})` : ""}`,
  );
}

/** Removes a log so a mistaken tap can be corrected. */
export async function undoLog(ctx: Ctx, itemId: string, slotAtInput: string): Promise<void> {
  requirePermission(ctx, "log-dose");
  const slotAt = new Date(slotAtInput);
  if (Number.isNaN(slotAt.getTime())) throw new AppError("bad-request", "Invalid slot.");
  const iso = slotAt.toISOString();
  const [log] = (await ctx.repo.listLogs(ctx.circle.code, iso, iso)).filter(
    (l) => l.itemId === itemId,
  );
  if (!log) return;
  await ctx.repo.deleteLog(ctx.circle.code, log.id);
  const item = await ctx.repo.getItem(ctx.circle.code, itemId);
  await recordActivity(
    ctx,
    "dose.undone",
    `Undid the ${clockLabel(iso, ctx.circle.timezone)} entry for ${item ? describeItem(item) : "an item"}`,
  );
}
