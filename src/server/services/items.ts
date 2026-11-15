// Medicines and routines: add, edit, pause/resume and delete, all through one schedule model.
import { limits } from "@/domain/config";
import { normaliseTimes } from "@/domain/schedule";
import type { Item } from "@/domain/types";
import { AppError } from "@/server/errors";
import { newId } from "@/server/auth/passcode";
import { itemSchema } from "@/server/validation";
import { parseInput, recordActivity, requirePermission, type Ctx } from "./context";

function describe(item: Pick<Item, "kind" | "name" | "dose">): string {
  return item.kind === "medicine" && item.dose ? `${item.name} ${item.dose}` : item.name;
}

function fromInput(input: unknown): Omit<Item, "id" | "active" | "createdAt"> {
  const d = parseInput(itemSchema, input);
  return {
    kind: d.kind,
    name: d.name,
    composition: d.kind === "medicine" ? d.composition : null,
    dose: d.kind === "medicine" ? d.dose : null,
    instructions: d.instructions,
    times: normaliseTimes(d.times),
    daysOfWeek: [...new Set(d.daysOfWeek)].sort(),
    startDate: d.startDate,
    endDate: d.endDate,
  };
}

async function load(ctx: Ctx, id: string): Promise<Item> {
  const item = await ctx.repo.getItem(ctx.circle.code, id);
  if (!item) throw new AppError("not-found", "That item no longer exists.");
  return item;
}

/** Adds a medicine or routine. */
export async function createItem(ctx: Ctx, input: unknown): Promise<Item> {
  requirePermission(ctx, "edit-schedule");
  const fields = fromInput(input);
  const count = (await ctx.repo.listItems(ctx.circle.code)).length;
  if (count >= limits.maxItems)
    throw new AppError("conflict", `A circle can have up to ${limits.maxItems} items.`);
  const item: Item = { id: newId(), ...fields, active: true, createdAt: ctx.now.toISOString() };
  await ctx.repo.putItem(ctx.circle.code, item);
  await recordActivity(
    ctx,
    "item.added",
    `Added ${item.kind} ${describe(item)} at ${item.times.join(", ")}`,
  );
  return item;
}

/** Edits a medicine or routine; past logs stay attached to the item. */
export async function updateItem(ctx: Ctx, id: string, input: unknown): Promise<Item> {
  requirePermission(ctx, "edit-schedule");
  const current = await load(ctx, id);
  const item: Item = { ...current, ...fromInput(input) };
  await ctx.repo.putItem(ctx.circle.code, item);
  await recordActivity(ctx, "item.updated", `Changed ${describe(item)}`);
  return item;
}

/** Pauses or resumes an item without losing its history. */
export async function setItemActive(ctx: Ctx, id: string, active: boolean): Promise<void> {
  requirePermission(ctx, "edit-schedule");
  const item = await load(ctx, id);
  await ctx.repo.putItem(ctx.circle.code, { ...item, active });
  await recordActivity(
    ctx,
    active ? "item.resumed" : "item.paused",
    `${active ? "Resumed" : "Paused"} ${describe(item)}`,
  );
}

/** Deletes an item. */
export async function deleteItem(ctx: Ctx, id: string): Promise<void> {
  requirePermission(ctx, "edit-schedule");
  const item = await load(ctx, id);
  await ctx.repo.deleteItem(ctx.circle.code, id);
  await recordActivity(ctx, "item.removed", `Removed ${describe(item)}`);
}

export { describe as describeItem };
