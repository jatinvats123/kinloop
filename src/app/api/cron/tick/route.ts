// Scheduler entry point, called every 5 minutes by GitHub Actions with the CRON_SECRET header.
// Window-based and idempotent: a late or repeated call sends each reminder at most once.
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { getMailer } from "@/server/email/mailer";
import { toHttpError } from "@/server/errors";
import { logger } from "@/server/logger";
import { runTick } from "@/server/reminders/tick";
import { getRepository } from "@/server/repositories";
import { isValidCronSecret } from "@/server/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const config = env();
  if (!isValidCronSecret(request.headers.get("x-cron-secret"), config.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  try {
    const result = await runTick({
      repo: await getRepository(),
      mailer: await getMailer(),
      now: new Date(),
      linkSecret: config.LINK_SECRET,
      appUrl: config.APP_URL ?? request.nextUrl.origin,
    });
    logger.info("cron tick", { ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("cron tick failed", { error: err instanceof Error ? err.name : "unknown" });
    const { status, body } = toHttpError(err);
    return NextResponse.json(body, { status });
  }
}
