"use server";
// Server actions for the AI helpers. Each is called only on an explicit user action, rate-limited
// per caller, and counted against the circle's daily AI quota inside the service.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clientKey, requireSession } from "@/server/auth/session";
import { getAiClient } from "@/server/ai/client";
import { readImage } from "@/server/ai/guards";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import type { Repository } from "@/server/repositories/repository";
import { checkLabel, type LabelCheckResult } from "@/server/services/label-check";
import {
  acceptDraft,
  draftFromPrescription,
  type MedicineDraft,
} from "@/server/services/prescription-import";
import { isProposal } from "@/server/services/proposals";
import { draftVisitBrief } from "@/server/services/visit-brief";
import type { BriefDraft } from "@/domain/types";
import { formToObject } from "@/server/validation";

const AI_PER_HOUR_PER_CALLER = 30;

async function limitCaller(repo: Repository, now: Date): Promise<void> {
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
    await limitCaller(ctx.repo, ctx.now);
    const result = await checkLabel(ctx, image, getAiClient());
    revalidatePath("/activity");
    return { ok: true, data: result };
  } catch (err) {
    return toActionError(err);
  }
}

export async function draftPrescriptionAction(
  _prev: ActionResult<MedicineDraft[]>,
  fd: FormData,
): Promise<ActionResult<MedicineDraft[]>> {
  try {
    const ctx = await requireSession();
    const photo = fd.get("photo");
    const image = photo instanceof Blob && photo.size > 0 ? await readImage(photo) : null;
    await limitCaller(ctx.repo, ctx.now);
    const text = String(fd.get("text") ?? "");
    const drafts = await draftFromPrescription(ctx, { text, image }, getAiClient());
    return { ok: true, data: drafts };
  } catch (err) {
    return toActionError(err);
  }
}

export async function acceptDraftAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const result = await acceptDraft(ctx, formToObject(fd, ["times", "daysOfWeek"]));
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: isProposal(result)
        ? `Sent to ${ctx.circle.elderName.split(" ")[0]} for approval.`
        : "Added to the medicines list.",
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function draftBriefAction(
  _prev: ActionResult<BriefDraft>,
  fd: FormData,
): Promise<ActionResult<BriefDraft>> {
  try {
    const ctx = await requireSession();
    const id = z.string().min(1).max(64).parse(fd.get("appointmentId"));
    await limitCaller(ctx.repo, ctx.now);
    return { ok: true, data: await draftVisitBrief(ctx, id, getAiClient()) };
  } catch (err) {
    return toActionError(err);
  }
}
