// Scheduler entry point, called every 5 minutes by GitHub Actions with the CRON_SECRET header.
// Window-based and idempotent: a late or repeated call does the same work once.
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { toHttpError } from "@/server/errors";
import { logger } from "@/server/logger";
import { getRepository } from "@/server/repositories";
import { isValidCronSecret } from "@/server/security/cron-auth";
import { purgeExpiredDemos } from "@/server/services/demo";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("x-cron-secret"), env().CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  try {
    const repo = await getRepository();
    const purged = await purgeExpiredDemos(repo, new Date());
    logger.info("cron tick", { purgedDemos: purged });
    return NextResponse.json({ ok: true, purgedDemos: purged });
  } catch (err) {
    logger.error("cron tick failed", { error: err instanceof Error ? err.name : "unknown" });
    const { status, body } = toHttpError(err);
    return NextResponse.json(body, { status });
  }
}
