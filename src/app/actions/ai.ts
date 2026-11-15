"use server";
// Server actions for the AI helpers. Each is called only on an explicit user action, rate-limited
// per caller, and counted against the circle's daily AI quota inside the service.
import { revalidatePath } from "next/cache";
import { clientKey, requireSession } from "@/server/auth/session";
import { getAiClient } from "@/server/ai/client";
import { readImage } from "@/server/ai/guards";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import { checkLabel, type LabelCheckResult } from "@/server/services/label-check";

const AI_PER_HOUR_PER_CALLER = 30;

async function limitCaller(now: Date, repo: Awaited<ReturnType<typeof requireSession>>["repo"]) {
  if (!(await repo.hitRateLimit(await clientKey("ai"), AI_PER_HOUR_PER_CALLER, 3600_000, now))) {
    throw new AppError("rate-limited", "Too many requests from here. Try again in a while.");
  }
}

export async function checkLabelAction(
  _prev: ActionResult<LabelCheckResult>,
  fd: FormData,
): Promise<ActionResult<LabelCheckResult>> {
  try {
    const ctx = await requireSession();
    const image = await readImage(fd.get("photo"));
    await limitCaller(ctx.now, ctx.repo);
    const result = await checkLabel(ctx, image, getAiClient());
    revalidatePath("/activity");
    return { ok: true, data: result };
  } catch (err) {
    return toActionError(err);
  }
}
