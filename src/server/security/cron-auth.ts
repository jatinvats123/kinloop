// Authenticates the scheduler's call to the cron endpoint with a shared secret in constant time.
import { timingSafeEqual } from "node:crypto";

/** True only when `provided` equals `expected` (a 32+ character secret); length leaks nothing useful. */
export function isValidCronSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected || expected.length < 32) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
