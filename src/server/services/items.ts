// Medicines and routines: add, edit, pause/resume and delete, all through one schedule model.
// With "Ask me first" on, changes by anyone but the elder become proposals instead.
import { limits } from "@/domain/config";
import { needsApproval } from "@/domain/permissions";
import { normaliseTimes } from "@/domain/schedule";
import type { Item, ItemDraft, Proposal } from "@/domain/types";
import { AppError } from "@/server/errors";
import { newId } from "@/server/auth/passcode";
import { itemSchema } from "@/server/validation";
import { parseInput, recordActivity, requirePermission, type Ctx } from "./context";
import { propose } from "./proposals";

function describe(item: Pick<Item, "kind" | "name" | "dose">): string {
  return item.kind === "medicine" && item.dose ? `${item.name} ${item.dose}` : item.name;
}

/** Validates item input into the fields a schedule item stores. */
export function itemFromInput(input: unknown): ItemDraft {
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

const draftOf = (item: Item): ItemDraft => ({
  kind: item.kind,
  name: item.name,
  composition: item.composition,
  dose: item.dose,
  instructions: item.instructions,
  times: item.times,
  daysOfWeek: item.daysOfWeek,
  startDate: item.startDate,
  endDate: item.endDate,
});

async function load(ctx: Ctx, id: string): Promise<Item> {
  const item = await ctx.repo.getItem(ctx.circle.code, id);
  if (!item) throw new AppError("not-found", "That item no longer exists.");
  return item;
}

/** Adds a medicine or routine, or proposes it when the elder asked to approve changes. */
export async function createItem(ctx: Ctx, input: unknown): Promise<Item | Proposal> {
  requirePermission(ctx, "edit-schedule");
  const fields = itemFromInput(input);
  const count = (await ctx.repo.listItems(ctx.circle.code)).length;
  if (count >= limits.maxItems)
    throw new AppError("conflict", `A circle can have up to ${limits.maxItems} items.`);
  const summary = `add ${fields.kind} ${describe(fields)} at ${fields.times.join(", ")}`;
  if (needsApproval(ctx.member, ctx.circle)) return propose(ctx, "add", null, fields, summary);
  const item: Item = { id: newId(), ...fields, active: true, createdAt: ctx.now.toISOString() };
  await ctx.repo.putItem(ctx.circle.code, item);
  await recordActivity(
    ctx,
    "item.added",
    `Added ${item.kind} ${describe(item)} at ${item.times.join(", ")}`,
  );
  return item;
}

/** Edits a medicine or routine (past logs stay attached), or proposes the edit. */
export async function updateItem(ctx: Ctx, id: string, input: unknown): Promise<Item | Proposal> {
  requirePermission(ctx, "edit-schedule");
  const current = await load(ctx, id);
  const fields = itemFromInput(input);
  if (needsApproval(ctx.member, ctx.circle)) {
    return propose(
      ctx,
      "update",
      id,
      fields,
      `change ${describe(current)} to ${describe(fields)} at ${fields.times.join(", ")}`,
    );
  }
  const item: Item = { ...current, ...fields };
  await ctx.repo.putItem(ctx.circle.code, item);
  await recordActivity(ctx, "item.updated", `Changed ${describe(item)}`);
  return item;
}

/** Pauses or resumes an item without losing its history; returns the proposal if one was made. */
export async function setItemActive(
  ctx: Ctx,
  id: string,
  active: boolean,
): Promise<Proposal | null> {
  requirePermission(ctx, "edit-schedule");
  const item = await load(ctx, id);
  const verb = active ? "resume" : "pause";
  if (needsApproval(ctx.member, ctx.circle)) {
    return propose(ctx, "update", id, { ...draftOf(item), active }, `${verb} ${describe(item)}`);
  }
  await ctx.repo.putItem(ctx.circle.code, { ...item, active });
  await recordActivity(
    ctx,
    active ? "item.resumed" : "item.paused",
    `${active ? "Resumed" : "Paused"} ${describe(item)}`,
  );
  return null;
}

/** Deletes an item; returns the proposal if one was made instead. */
export async function deleteItem(ctx: Ctx, id: string): Promise<Proposal | null> {
  requirePermission(ctx, "edit-schedule");
  const item = await load(ctx, id);
  if (needsApproval(ctx.member, ctx.circle)) {
    return propose(ctx, "remove", id, null, `remove ${describe(item)}`);
  }
  await ctx.repo.deleteItem(ctx.circle.code, id);
  await recordActivity(ctx, "item.removed", `Removed ${describe(item)}`);
  return null;
}

export { describe as describeItem };
