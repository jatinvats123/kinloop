// Prescription import: the AI drafts medicines from pasted text or a photo; nothing is saved until a
// person accepts each draft, which then goes through the normal add (or "Ask me first") path.
import { addDays, todayIn } from "@/domain/time";
import type { Item, Proposal } from "@/domain/types";
import { AppError } from "@/server/errors";
import { AiOutputError, type AiClient, type AiImage } from "@/server/ai/client";
import { reserveAi } from "@/server/ai/guards";
import {
  LOW_CONFIDENCE,
  MAX_PRESCRIPTION_TEXT,
  readPrescription,
} from "@/server/ai/prescription-reader";
import { recordActivity, requirePermission, type Ctx } from "./context";
import { createItem } from "./items";

/** A reviewable draft: the form values plus which fields the AI was unsure about. */
export interface MedicineDraft {
  key: string;
  name: string;
  composition: string;
  dose: string;
  instructions: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate: string;
  unsure: Array<"name" | "dose" | "times">;
}

/**
 * Drafts medicines from prescription text and/or a photo. Requires edit access (or the elder);
 * counted against the daily AI quota. Malformed AI output is reported as "couldn't read".
 */
export async function draftFromPrescription(
  ctx: Ctx,
  input: { text: string; image: AiImage | null },
  client: AiClient | null,
): Promise<MedicineDraft[]> {
  requirePermission(ctx, "edit-schedule");
  const text = input.text.trim();
  if (!text && !input.image) {
    throw new AppError("bad-request", "Paste the prescription or choose a photo.", {
      text: "Paste the prescription or choose a photo.",
    });
  }
  if (text.length > MAX_PRESCRIPTION_TEXT) {
    const msg = `Keep the text under ${MAX_PRESCRIPTION_TEXT} characters.`;
    throw new AppError("bad-request", msg, { text: msg });
  }
  if (!client) {
    throw new AppError(
      "unavailable",
      "The prescription reader isn't available right now. You can still add medicines by hand.",
    );
  }
  await reserveAi(ctx.repo, ctx.circle.code, ctx.now);

  let medicines;
  try {
    medicines = await readPrescription(client, { text, image: input.image });
  } catch (err) {
    if (err instanceof AiOutputError) {
      throw new AppError(
        "unavailable",
        "Couldn't read that prescription. Try clearer text or add medicines by hand.",
      );
    }
    throw err;
  }
  const today = todayIn(ctx.circle.timezone, ctx.now);
  await recordActivity(
    ctx,
    "prescription.read",
    `Read a prescription with the AI helper: ${medicines.length} draft${medicines.length === 1 ? "" : "s"} to review`,
  );
  return medicines.map((m, i) => ({
    key: `d${i}`,
    name: m.name,
    composition: m.composition ?? "",
    dose: m.dose ?? "",
    instructions: m.instructions,
    times: [...new Set(m.times)].sort(),
    daysOfWeek: [...new Set(m.daysOfWeek)].sort(),
    startDate: today,
    endDate: m.durationDays ? addDays(today, m.durationDays - 1) : "",
    unsure: (["name", "dose", "times"] as const).filter((f) => m.confidence[f] < LOW_CONFIDENCE),
  }));
}

/**
 * Saves one reviewed draft as a medicine through the normal path: validated, permission-checked,
 * and turned into a proposal when "Ask me first" is on and the person is not the elder.
 */
export function acceptDraft(ctx: Ctx, input: unknown): Promise<Item | Proposal> {
  return createItem(ctx, input);
}
