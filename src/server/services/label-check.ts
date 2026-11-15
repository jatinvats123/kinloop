// Right-medicine check: the elder photographs a strip or box, the AI reads the label, `matchLabel`
// compares it with the schedule, and the result is recorded in the activity feed.
import { matchLabel, type LabelVerdict } from "@/domain/label-match";
import { t } from "@/domain/messages";
import { addDays, clockLabel, todayIn, zonedToUtc } from "@/domain/time";
import { AppError } from "@/server/errors";
import { AiOutputError, type AiClient, type AiImage } from "@/server/ai/client";
import { reserveAi } from "@/server/ai/guards";
import { readLabel } from "@/server/ai/label-reader";
import { recordActivity, requirePermission, type Ctx } from "./context";
import { describeItem } from "./items";

export interface LabelCheckResult {
  verdict: LabelVerdict;
  /** One plain sentence for the verdict panel, from the message dictionary. */
  message: string;
  /** Present only for a due-now match: what "Mark as taken" logs. */
  mark: { slotAt: string; itemId: string } | null;
}

/** First name of an organiser other than the elder, for "check with Priya or your doctor". */
async function helperName(ctx: Ctx): Promise<string> {
  const members = await ctx.repo.listMembers(ctx.circle.code);
  const helper =
    members.find((m) => m.role !== "elder" && m.isOrganiser) ??
    members.find((m) => m.role !== "elder");
  return helper?.name.split(" ")[0] ?? "your family";
}

const VERDICT_ACTIVITY: Record<LabelVerdict, string> = {
  "due-now": "matches the schedule now",
  "not-now": "is on the list but not due now",
  "already-taken": "was already taken",
  "strength-mismatch": "has a different strength from the list",
  "not-on-list": "is not on the list",
  unreadable: "could not be read",
};

/**
 * Reads a label photo with the AI and compares it with the schedule. Malformed or out-of-range AI
 * output becomes "unreadable"; an unreachable AI or used-up quota is an error the page explains.
 */
export async function checkLabel(
  ctx: Ctx,
  image: AiImage,
  client: AiClient | null,
): Promise<LabelCheckResult> {
  requirePermission(ctx, "view");
  if (!client) {
    throw new AppError("unavailable", "The label checker isn't available right now.");
  }
  await reserveAi(ctx.repo, ctx.circle.code, ctx.now);

  let reading = null;
  try {
    reading = await readLabel(client, image);
  } catch (err) {
    if (!(err instanceof AiOutputError)) throw err;
  }

  const zone = ctx.circle.timezone;
  const today = todayIn(zone, ctx.now);
  const [items, logs] = await Promise.all([
    ctx.repo.listItems(ctx.circle.code),
    ctx.repo.listLogs(
      ctx.circle.code,
      zonedToUtc(addDays(today, -1), "00:00", zone).toISOString(),
      zonedToUtc(addDays(today, 1), "23:59", zone).toISOString(),
    ),
  ]);
  const match = reading
    ? matchLabel(reading, items, logs, ctx.now, zone)
    : {
        verdict: "unreadable" as const,
        item: null,
        slotAt: null,
        takenAt: null,
        labelStrength: null,
        listStrength: null,
      };

  const name = match.item ? describeItem(match.item) : "";
  const time = match.slotAt ? clockLabel(match.slotAt, zone) : "";
  let message: string;
  switch (match.verdict) {
    case "due-now":
      message = t("check.dueNow", { time, item: name });
      break;
    case "not-now":
      message = match.slotAt ? t("check.notNow", { time }) : t("check.notToday");
      break;
    case "already-taken":
      message = t("check.alreadyTaken", { time: clockLabel(match.takenAt ?? ctx.now, zone) });
      break;
    case "strength-mismatch":
      message = t("check.strengthMismatch", {
        label: match.labelStrength ?? "",
        list: match.listStrength ?? "",
      });
      break;
    case "not-on-list":
      message = t("check.notOnList", { person: await helperName(ctx) });
      break;
    default:
      message = t("check.unreadable");
  }

  await recordActivity(
    ctx,
    "label.checked",
    `Checked a medicine label: ${name ? `${name} ` : "it "}${VERDICT_ACTIVITY[match.verdict]}`,
  );
  return {
    verdict: match.verdict,
    message,
    mark:
      match.verdict === "due-now" && match.item && match.slotAt
        ? { slotAt: match.slotAt, itemId: match.item.id }
        : null,
  };
}
