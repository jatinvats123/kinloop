// Request context passed to every service, plus the shared guard and activity helpers.
import { can, type Action } from "@/domain/permissions";
import type { Circle, Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import { newId } from "@/server/auth/passcode";
import type { Repository } from "@/server/repositories/repository";
import type { z } from "zod";
import { fieldErrors } from "@/server/validation";

export interface Ctx {
  repo: Repository;
  circle: Circle;
  member: Member;
  now: Date;
}

/** Throws a forbidden error unless the signed-in member may perform `action`. */
export function requirePermission(ctx: Ctx, action: Action): void {
  if (!can(ctx.member, action, ctx.circle)) {
    throw new AppError("forbidden", "You don't have permission to do that.");
  }
}

/** Appends an entry to the circle's activity feed. Summaries never include passcodes or emails. */
export async function recordActivity(ctx: Ctx, action: string, summary: string): Promise<void> {
  await ctx.repo.addActivity(ctx.circle.code, {
    id: `${ctx.now.getTime().toString(36)}-${newId()}`,
    actorId: ctx.member.id,
    actor: ctx.member.name,
    action,
    summary,
    at: ctx.now.toISOString(),
  });
}

/** Parses input with a schema, converting failures into a bad-request error with field messages. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      "bad-request",
      "Please check the highlighted fields.",
      fieldErrors(result.error),
    );
  }
  return result.data;
}
