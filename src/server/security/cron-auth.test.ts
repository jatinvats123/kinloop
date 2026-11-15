import { describe, expect, it } from "vitest";
import { AppError, toActionError, toHttpError } from "@/server/errors";
import { isValidCronSecret } from "./cron-auth";

const SECRET = "s".repeat(43);

describe("isValidCronSecret", () => {
  it("accepts only the exact secret", () => {
    expect(isValidCronSecret(SECRET, SECRET)).toBe(true);
    expect(isValidCronSecret(`${SECRET}x`, SECRET)).toBe(false);
    expect(isValidCronSecret("t".repeat(43), SECRET)).toBe(false);
  });

  it("rejects a missing header or an unset or weak secret", () => {
    expect(isValidCronSecret(null, SECRET)).toBe(false);
    expect(isValidCronSecret(SECRET, undefined)).toBe(false);
    expect(isValidCronSecret("short", "short")).toBe(false);
  });
});

describe("AppError mapping", () => {
  it("maps codes to HTTP statuses and keeps field errors for forms", () => {
    const err = new AppError("forbidden", "No.", { name: "Bad" });
    expect(err.status).toBe(403);
    expect(toHttpError(err)).toEqual({ status: 403, body: { error: "No." } });
    expect(toActionError(err)).toEqual({ ok: false, error: "No.", fieldErrors: { name: "Bad" } });
  });

  it("never leaks details of unexpected errors", () => {
    expect(toHttpError(new Error("db password wrong"))).toEqual({
      status: 500,
      body: { error: "Something went wrong." },
    });
    expect(toActionError("boom").error).toBe("Something went wrong. Please try again.");
  });
});
