// Per-circle daily email cap, counted in the circle document so it holds across serverless instances.
import { limits } from "@/domain/config";
import { todayIn } from "@/domain/time";
import type { Repository } from "@/server/repositories/repository";

/**
 * Reserves up to `wanted` emails from the circle's daily allowance in one transaction and returns
 * how many may be sent (0 when the cap is reached or the circle is gone).
 */
export async function reserveMail(
  repo: Repository,
  code: string,
  wanted: number,
  now: Date,
  cap: number = limits.mailPerCircleDay,
): Promise<number> {
  if (wanted <= 0) return 0;
  let granted = 0;
  await repo.transactCircle(code, (circle) => {
    const day = todayIn(circle.timezone, now);
    const used = circle.quota.mailDay === day ? circle.quota.mailCount : 0;
    granted = Math.max(0, Math.min(wanted, cap - used));
    if (granted === 0) return null;
    return { quota: { ...circle.quota, mailDay: day, mailCount: used + granted } };
  });
  return granted;
}
