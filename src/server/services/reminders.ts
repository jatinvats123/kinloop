// Reminders log: sent and upcoming reminder emails, and "send a test reminder to my email"
// (rate-limited per member, counted against the circle's daily cap).
import { z } from "zod";
import { upcomingReminders, type UpcomingReminder } from "@/domain/reminders";
import type { Member, Notification } from "@/domain/types";
import { AppError } from "@/server/errors";
import type { Mailer } from "@/server/email/mailer";
import { reserveMail } from "@/server/email/quota";
import { testEmail } from "@/server/email/templates";
import { parseInput, recordActivity, type Ctx } from "./context";
import { syncMailFlag } from "./members";

const TEST_PER_HOUR = 3;
const HOUR_MS = 3600_000;
const SENT_DAYS = 7;

export interface RemindersView {
  sent: Array<Notification & { toName: string }>;
  upcoming: Array<UpcomingReminder & { toNames: string[] }>;
  myEmail: string | null;
  anyEmail: boolean;
}

/** Sent reminders from the last week and those coming up in the next 24 hours. */
export async function buildRemindersView(ctx: Ctx): Promise<RemindersView> {
  const { repo, circle, now } = ctx;
  const t = now.getTime();
  const [members, items, logs, appointments, sent] = await Promise.all([
    repo.listMembers(circle.code),
    repo.listItems(circle.code),
    repo.listLogs(
      circle.code,
      new Date(t - HOUR_MS).toISOString(),
      new Date(t + 25 * HOUR_MS).toISOString(),
    ),
    repo.listAppointments(circle.code, now.toISOString(), 10),
    repo.listNotifications(circle.code, new Date(t - SENT_DAYS * 24 * HOUR_MS).toISOString(), 50),
  ]);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "A former member";
  const upcoming = upcomingReminders(
    { circle, members, items, logs, appointments, sentKeys: new Set(), now },
    24 * 60,
  );
  return {
    sent: sent.map((n) => ({ ...n, toName: name(n.to) })),
    upcoming: upcoming.map((u) => ({ ...u, toNames: u.memberIds.map(name) })),
    myEmail: ctx.member.email,
    anyEmail: members.some((m: Member) => Boolean(m.email)),
  };
}

const testSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(120)),
});

/**
 * Saves the signed-in member's email (so the real ladder reaches it) and sends them one test
 * reminder. At most 3 per member per hour, and counted against the circle's daily email cap.
 */
export async function sendTestReminder(
  ctx: Ctx,
  input: unknown,
  mailer: Mailer,
  appUrl: string,
): Promise<void> {
  const { email } = parseInput(testSchema, input);
  const key = `test-mail-${ctx.circle.code}-${ctx.member.id}`;
  if (!(await ctx.repo.hitRateLimit(key, TEST_PER_HOUR, HOUR_MS, ctx.now))) {
    throw new AppError("rate-limited", "You've sent three test emails this hour. Try again later.");
  }
  if (ctx.member.email !== email) {
    await ctx.repo.putMember(ctx.circle.code, { ...ctx.member, email });
    await syncMailFlag(ctx);
  }
  if ((await reserveMail(ctx.repo, ctx.circle.code, 1, ctx.now)) === 0) {
    throw new AppError("rate-limited", "This circle has reached today's email limit.");
  }
  const sentAt = ctx.now.toISOString();
  try {
    await mailer.send({ to: email, ...testEmail(ctx.circle.elderName, ctx.member.name, appUrl) });
  } catch {
    throw new AppError("unavailable", "The email couldn't be sent just now. Please try again.");
  }
  await ctx.repo.claimNotification(ctx.circle.code, {
    id: `test_${sentAt}_${ctx.member.id}`,
    type: "test",
    to: ctx.member.id,
    at: sentAt,
    sentAt,
    itemCount: 0,
  });
  await recordActivity(ctx, "reminder.test", "Sent a test reminder to their email");
}
