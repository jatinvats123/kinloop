import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { signLink, verifyLink } from "./signed-link";

const SECRET = "test-link-secret-0123456789abcdef";
const SLOT = "2026-11-15T02:30:00.000Z";
const claims = {
  circle: "ACDEFGHJ",
  slotAt: SLOT,
  memberId: "m-elder",
  purpose: "confirm" as const,
};
const at = (hours: number) => new Date(Date.parse(SLOT) + hours * 3600_000);

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : "other";
  }
  return undefined;
}

describe("signed links", () => {
  it("round-trips the bound circle, slot, member and purpose", () => {
    const token = signLink(claims, SECRET);
    expect(verifyLink(token, "confirm", SECRET, at(1))).toMatchObject(claims);
  });

  it("rejects a tampered payload, such as another circle", () => {
    const [, sig] = signLink(claims, SECRET).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...claims, circle: "ZZZZZZZZ", exp: Date.parse(SLOT) + 3600_000 }),
    ).toString("base64url");
    expect(code(() => verifyLink(`${forged}.${sig}`, "confirm", SECRET, at(1)))).toBe("forbidden");
  });

  it("rejects a token signed with another secret", () => {
    const token = signLink(claims, "another-secret-0123456789abcdefgh");
    expect(code(() => verifyLink(token, "confirm", SECRET, at(1)))).toBe("forbidden");
  });

  it("rejects the wrong purpose", () => {
    const token = signLink(claims, SECRET);
    expect(code(() => verifyLink(token, "follow-up", SECRET, at(1)))).toBe("forbidden");
  });

  it("expires 12 hours after the slot", () => {
    const token = signLink(claims, SECRET);
    expect(code(() => verifyLink(token, "confirm", SECRET, at(12)))).toBeUndefined();
    expect(code(() => verifyLink(token, "confirm", SECRET, at(12.01)))).toBe("bad-request");
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "abc", "a.b.c", "x".repeat(700), "@@@.@@@"]) {
      expect(code(() => verifyLink(bad, "confirm", SECRET, at(1)))).toBe("forbidden");
    }
    const junk = Buffer.from("not json").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(`kl1.${junk}`).digest("base64url");
    expect(code(() => verifyLink(`${junk}.${sig}`, "confirm", SECRET, at(1)))).toBe("forbidden");
  });
});
