// Visit brief: facts computed by code for an appointment, plus an AI draft of things to mention and
// questions to ask, cached by a hash of those facts. The facts never depend on the AI succeeding.
import { createHash } from "node:crypto";
import { addDays, todayIn, zonedToUtc } from "@/domain/time";
import type { Appointment, BriefDraft } from "@/domain/types";
import { BRIEF_DAYS, buildVisitBriefFacts, type BriefFacts } from "@/domain/visit-brief";
import { AppError } from "@/server/errors";
import { AiOutputError, type AiClient } from "@/server/ai/client";
import { writeBriefPoints } from "@/server/ai/brief-writer";
import { reserveAi } from "@/server/ai/guards";
import { recordActivity, requirePermission, type Ctx } from "./context";

/** Re-opening the same brief within this window is not recorded again (keeps the feed calm). */
const REOPEN_QUIET_MS = 10 * 60_000;

export interface VisitBrief {
  appointment: Appointment;
  facts: BriefFacts;
  /** The cached AI draft, only when it was written from exactly these facts. */
  draft: BriefDraft | null;
  /** True when this opening was newly recorded in the activity feed. */
  recorded: boolean;
}

/** Stable SHA-256 of the facts; any change to the facts invalidates the cached draft. */
export function hashFacts(facts: BriefFacts): string {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}

async function loadFacts(ctx: Ctx, appointmentId: string) {
  const { repo, circle, now } = ctx;
  const appointment = await repo.getAppointment(circle.code, appointmentId);
  if (!appointment) throw new AppError("not-found", "That visit no longer exists.");
  const from = zonedToUtc(
    addDays(todayIn(circle.timezone, now), -(BRIEF_DAYS - 1)),
    "00:00",
    circle.timezone,
  );
  const [items, logs] = await Promise.all([
    repo.listItems(circle.code),
    repo.listLogs(circle.code, from.toISOString(), now.toISOString()),
  ]);
  const facts = buildVisitBriefFacts({ circle, appointment, items, logs, now });
  return { appointment, facts, factsHash: hashFacts(facts) };
}

/**
 * Opens the brief for an appointment: computed facts plus any cached AI draft that still matches
 * them. Any member may open it; opening is recorded in the activity feed (once per 10 minutes).
 */
export async function openVisitBrief(ctx: Ctx, appointmentId: string): Promise<VisitBrief> {
  requirePermission(ctx, "view");
  const { appointment, facts, factsHash } = await loadFacts(ctx, appointmentId);
  const [cached, recent] = await Promise.all([
    ctx.repo.getBriefDraft(ctx.circle.code, appointmentId),
    ctx.repo.listActivity(ctx.circle.code, 5),
  ]);
  const summary = `Opened the visit brief for ${appointment.doctor}`;
  const since = new Date(ctx.now.getTime() - REOPEN_QUIET_MS).toISOString();
  const recorded = !recent.some(
    (a) => a.actorId === ctx.member.id && a.summary === summary && a.at >= since,
  );
  if (recorded) await recordActivity(ctx, "brief.opened", summary);
  return {
    appointment,
    facts,
    draft: cached?.factsHash === factsHash ? cached : null,
    recorded,
  };
}

/**
 * Drafts "things to mention" and "questions to ask" for an appointment. Returns the cached draft
 * when the facts are unchanged (no AI call, no quota); otherwise calls the model once.
 */
export async function draftVisitBrief(
  ctx: Ctx,
  appointmentId: string,
  client: AiClient | null,
): Promise<BriefDraft> {
  requirePermission(ctx, "view");
  const { facts, factsHash } = await loadFacts(ctx, appointmentId);
  const cached = await ctx.repo.getBriefDraft(ctx.circle.code, appointmentId);
  if (cached?.factsHash === factsHash) return cached;
  if (!client) {
    throw new AppError(
      "unavailable",
      "The AI helper isn't available right now. The facts above are complete without it.",
    );
  }
  await reserveAi(ctx.repo, ctx.circle.code, ctx.now);
  let points;
  try {
    points = await writeBriefPoints(client, facts);
  } catch (err) {
    if (err instanceof AiOutputError) {
      throw new AppError("unavailable", "Couldn't draft points this time. Please try again.");
    }
    throw err;
  }
  const draft: BriefDraft = { appointmentId, factsHash, ...points, at: ctx.now.toISOString() };
  await ctx.repo.putBriefDraft(ctx.circle.code, draft);
  return draft;
}
