"use server";
// Server action for "send a test reminder to my email": session guard, per-IP limit, service call.
import { revalidatePath } from "next/cache";
import { clientKey, requireSession } from "@/server/auth/session";
import { getMailer } from "@/server/email/mailer";
import { env } from "@/server/env";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import { sendTestReminder } from "@/server/services/reminders";
import { formToObject } from "@/server/validation";

const IP_TESTS_PER_HOUR = 6;

export async function sendTestReminderAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const ipKey = await clientKey("test-mail");
    if (!(await ctx.repo.hitRateLimit(ipKey, IP_TESTS_PER_HOUR, 3600_000, ctx.now))) {
      throw new AppError("rate-limited", "Too many test emails from here. Try again later.");
    }
    const appUrl = env().APP_URL ?? "http://localhost:3000";
    await sendTestReminder(ctx, formToObject(fd), await getMailer(), appUrl);
    revalidatePath("/reminders");
    return {
      ok: true,
      message: "Sent. Check your inbox (and spam folder). Real reminders will now reach you too.",
    };
  } catch (err) {
    return toActionError(err);
  }
}
