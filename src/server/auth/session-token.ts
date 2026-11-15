// Session tokens: HS256 JWTs carrying the circle code, member ID and a passcode-derived version so
// regenerating a passcode signs out that member's old sessions.
import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { auth } from "@/domain/config";

export interface SessionClaims {
  code: string;
  memberId: string;
  version: string;
}

const encoder = new TextEncoder();

/** Short fingerprint of the member's passcode hash, used to invalidate sessions on regeneration. */
export function sessionVersion(passcodeHash: string): string {
  return createHash("sha256").update(passcodeHash).digest("base64url").slice(0, 12);
}

/** Signs a session token valid for the configured session length. */
export async function signSession(
  claims: SessionClaims,
  secret: string,
  now = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ c: claims.code, m: claims.memberId, v: claims.version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + auth.sessionHours * 3600)
    .setIssuer("kinloop")
    .sign(encoder.encode(secret));
}

/** Verifies a session token; returns null for anything invalid, expired or malformed. */
export async function verifySession(
  token: string,
  secret: string,
  now = new Date(),
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      issuer: "kinloop",
      algorithms: ["HS256"],
      currentDate: now,
    });
    const { c, m, v } = payload;
    if (typeof c !== "string" || typeof m !== "string" || typeof v !== "string") return null;
    return { code: c, memberId: m, version: v };
  } catch {
    return null;
  }
}
