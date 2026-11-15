// The one application error type, mapped to HTTP status codes and safe user-facing messages.

export type AppErrorCode =
  | "bad-request"
  | "unauthorised"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "locked"
  | "rate-limited"
  | "unavailable";

const statusByCode: Record<AppErrorCode, number> = {
  "bad-request": 400,
  unauthorised: 401,
  forbidden: 403,
  "not-found": 404,
  conflict: 409,
  locked: 423,
  "rate-limited": 429,
  unavailable: 503,
};

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return statusByCode[this.code];
  }
}

/** Standard result shape returned by server actions to forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Converts any thrown value into a safe action result; unknown errors never leak details. */
export function toActionError(err: unknown): {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
} {
  if (err instanceof AppError)
    return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** Converts any thrown value into an HTTP status and JSON body for route handlers. */
export function toHttpError(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof AppError) return { status: err.status, body: { error: err.message } };
  return { status: 500, body: { error: "Something went wrong." } };
}
