// The cron tick: for every circle with an email address, plan the reminders due now, claim each
// one (create-if-absent) before sending, release the claim if sending fails, and purge expired
// demos. Bounded concurrency and a time budget keep it inside the serverless time limit.
import { describeItem } from "@/server/services/items";
import { MINUTE_MS } from "@/domain/config";
import { planReminders, type PlannedReminder } from "@/domain/reminders";
import type { Appointment, Circle, Item, Member } from "@/domain/types";
import { mapLimit } from "@/server/concurrency";
import type { Mailer } from "@/server/email/mailer";
import { reserveMail } from "@/server/email/quota";
import { reminderEmail } from "@/server/email/templates";
import type { Repository } from "@/server/repositories/repository";
import { signLink } from "@/server/security/signed-link";
import { purgeExpiredDemos } from "@/server/services/demo";

export interface TickDeps {
  repo: Repository;
  mailer: Mailer;
  now: Date;
  linkSecret: string;
  appUrl: string;
  /** Stop starting new circles after this many milliseconds. */
  budgetMs?: number;
}

export interface TickResult {
  circles: number;
  sent: number;
  failed: number;
  capped: number;
  purgedDemos: number;
}

const MAX_CIRCLES = 200;
const CIRCLE_CONCURRENCY = 4;
const DEFAULT_BUDGET_MS = 40_000;

interface CircleTotals {
  sent: number;
  failed: number;
  capped: number;
}

/** Absolute links for a reminder: one-tap confirm for the elder, follow-up for the circle. */
export function reminderLinks(
  appUrl: string,
  secret: string,
  circle: string,
  r: Pick<PlannedReminder, "stage" | "at" | "memberId">,
): string | null {
  const base = appUrl.replace(/\/$/, "");
  if (r.stage === "due" || r.stage === "missed-elder") {
    return `${base}/confirm?t=${signLink({ circle, slotAt: r.at, memberId: r.memberId, purpose: "confirm" }, secret)}`;
  }
  if (r.stage === "missed-circle") {
    return `${base}/check-on?t=${signLink({ circle, slotAt: r.at, memberId: r.memberId, purpose: "follow-up" }, secret)}`;
  }
  return null;
}

async function sendOne(
  deps: TickDeps,
  circle: Circle,
  r: PlannedReminder,
  ctx: { members: Map<string, Member>; items: Map<string, Item>; appts: Map<string, Appointment> },
): Promise<"sent" | "failed" | "skipped"> {
  const member = ctx.members.get(r.memberId);
  if (!member?.email) return "skipped";
  const claimed = await deps.repo.claimNotification(circle.code, {
    id: r.key,
    type: r.stage,
    to: member.id,
    at: r.at,
    sentAt: deps.now.toISOString(),
    itemCount: r.itemIds.length,
  });
  if (!claimed) return "skipped";
  const email = reminderEmail({
    stage: r.stage,
    elderName: circle.elderName,
    recipientName: member.name,
    timezone: circle.timezone,
    at: r.at,
    items: r.itemIds.flatMap((id) => {
      const item = ctx.items.get(id);
      return item ? [{ name: describeItem(item), detail: item.instructions }] : [];
    }),
    appointment: r.appointmentId ? (ctx.appts.get(r.appointmentId) ?? null) : null,
    actionUrl: reminderLinks(deps.appUrl, deps.linkSecret, circle.code, r),
    appUrl: deps.appUrl,
  });
  try {
    await deps.mailer.send({ to: member.email, ...email });
    return "sent";
  } catch {
    await deps.repo.releaseNotification(circle.code, r.key);
    return "failed";
  }
}

/** Plans and sends every reminder due now for one circle. */
export async function processCircle(deps: TickDeps, code: string): Promise<CircleTotals> {
  const totals: CircleTotals = { sent: 0, failed: 0, capped: 0 };
  const { repo, now } = deps;
  const circle = await repo.getCircle(code);
  if (!circle) return totals;
  const t = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  const [members, items, logs, appointments, notifications] = await Promise.all([
    repo.listMembers(code),
    repo.listItems(code),
    repo.listLogs(code, iso(t - 7 * 60 * MINUTE_MS), iso(t + 60 * MINUTE_MS)),
    repo.listAppointments(code, now.toISOString(), 10),
    repo.listNotifications(code, iso(t - 25 * 60 * MINUTE_MS), 300),
  ]);
  const plan = planReminders({
    circle,
    members,
    items,
    logs,
    appointments,
    sentKeys: new Set(notifications.map((n) => n.id)),
    now,
  });
  if (plan.length === 0) return totals;

  const allowed = await reserveMail(repo, code, plan.length, now);
  totals.capped = plan.length - allowed;
  const lookup = {
    members: new Map(members.map((m) => [m.id, m])),
    items: new Map(items.map((i) => [i.id, i])),
    appts: new Map(appointments.map((a) => [a.id, a])),
  };
  for (const r of plan.slice(0, allowed)) {
    const outcome = await sendOne(deps, circle, r, lookup);
    if (outcome === "sent") totals.sent += 1;
    if (outcome === "failed") totals.failed += 1;
  }
  return totals;
}

/** Runs one tick across all mail-enabled circles, then purges expired demo circles. */
export async function runTick(deps: TickDeps): Promise<TickResult> {
  const started = Date.now();
  const budget = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  const codes = await deps.repo.listMailEnabledCircles(MAX_CIRCLES);
  const results = await mapLimit(codes, CIRCLE_CONCURRENCY, async (code) => {
    if (Date.now() - started > budget) return { sent: 0, failed: 0, capped: 0 };
    return processCircle(deps, code);
  });
  const purgedDemos = await purgeExpiredDemos(deps.repo, deps.now);
  return {
    circles: codes.length,
    sent: results.reduce((n, r) => n + r.sent, 0),
    failed: results.reduce((n, r) => n + r.failed, 0),
    capped: results.reduce((n, r) => n + r.capped, 0),
    purgedDemos,
  };
}
