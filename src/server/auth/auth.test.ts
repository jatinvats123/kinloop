import { describe, expect, it } from "vitest";
import { parseCircleCode } from "@/domain/codes";
import { hashPasscode, newCircleCode, newId, newPasscode, verifyPasscode } from "./passcode";
import { sessionVersion, signSession, verifySession } from "./session-token";

const SECRET = "a".repeat(40);

describe("passcode hashing", () => {
  it("verifies the right passcode and rejects a wrong one", async () => {
    const { hash, salt } = await hashPasscode("004279");
    expect(await verifyPasscode("004279", hash, salt)).toBe(true);
    expect(await verifyPasscode("004278", hash, salt)).toBe(false);
  });

  it("salts each hash differently", async () => {
    const a = await hashPasscode("123456");
    const b = await hashPasscode("123456");
    expect(a.hash).not.toBe(b.hash);
  });

  it("rejects when nothing is stored", async () => {
    expect(await verifyPasscode("123456", "", "")).toBe(false);
  });

  it("generates well-formed codes, passcodes and ids", () => {
    expect(parseCircleCode(newCircleCode())).not.toBeNull();
    expect(newPasscode()).toMatch(/^\d{6}$/);
    expect(newId()).toMatch(/^[\w-]{12}$/);
  });
});

describe("session tokens", () => {
  const claims = { code: "ACDEFGHJ", memberId: "m1", version: sessionVersion("hash") };

  it("round-trips claims", async () => {
    const token = await signSession(claims, SECRET);
    expect(await verifySession(token, SECRET)).toEqual(claims);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession(claims, SECRET);
    expect(await verifySession(token, "b".repeat(40))).toBeNull();
  });

  it("expires after twelve hours", async () => {
    const issued = new Date("2026-11-14T00:00:00Z");
    const token = await signSession(claims, SECRET, issued);
    expect(await verifySession(token, SECRET, new Date("2026-11-14T11:59:00Z"))).not.toBeNull();
    expect(await verifySession(token, SECRET, new Date("2026-11-14T12:01:00Z"))).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not-a-token", SECRET)).toBeNull();
  });

  it("changes version when the passcode hash changes", () => {
    expect(sessionVersion("a")).not.toBe(sessionVersion("b"));
  });
});
