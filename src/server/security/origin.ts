// Same-origin check for state-changing requests (CSRF defence in depth on top of SameSite cookies).

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Paths called by machines (Cloud Scheduler) that authenticate with a token instead of a cookie. */
const MACHINE_PATHS = ["/api/cron/"];

/**
 * Returns true when the request may proceed: safe methods, machine endpoints, or an
 * `Origin` header whose host equals the host the request was sent to.
 */
export function isAllowedOrigin(
  method: string,
  pathname: string,
  origin: string | null,
  host: string | null,
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  if (MACHINE_PATHS.some((p) => pathname.startsWith(p))) return true;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
