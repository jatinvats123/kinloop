// Signed email links (one-tap confirm, "I'll check on them"): HMAC-SHA256 over a small payload bound
// to circle, slot, member and purpose, expiring 12 hours after the slot. Opening a link never mutates.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { LINK_TTL_AFTER_SLOT_HOURS } from "@/domain/config";
import { AppError } from "@/server/errors";

export type LinkPurpose = "confirm" | "follow-up";

export interface LinkClaims {
  circle: string;
  slotAt: string;
  memberId: string;
  purpose: LinkPurpose;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

const claimsSchema = z.object({
  circle: z.string().min(1).max(20),
  slotAt: z.iso.datetime(),
  memberId: z.string().min(1).max(40),
  purpose: z.enum(["confirm", "follow-up"]),
  exp: z.number().int().positive(),
});

const VERSION = "kl1";
const MAX_TOKEN = 600;

function mac(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${VERSION}.${payload}`).digest();
}

/** Signs a link token for `claims`; it expires 12 hours after the slot. */
export function signLink(claims: Omit<LinkClaims, "exp">, secret: string): string {
  const exp = Date.parse(claims.slotAt) + LINK_TTL_AFTER_SLOT_HOURS * 3600_000;
  const payload = Buffer.from(JSON.stringify({ ...claims, exp })).toString("base64url");
  return `${payload}.${mac(payload, secret).toString("base64url")}`;
}

const invalid = () => new AppError("forbidden", "This link isn't valid.");

/**
 * Verifies a link token's signature, purpose and expiry and returns its claims.
 * Throws `forbidden` for tampered, malformed or wrong-purpose tokens and `bad-request` when expired.
 */
export function verifyLink(
  token: string,
  purpose: LinkPurpose,
  secret: string,
  now: Date,
): LinkClaims {
  if (typeof token !== "string" || token.length > MAX_TOKEN) throw invalid();
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) throw invalid();
  const expected = mac(payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  const claims = claimsSchema.safeParse(parsed);
  if (!claims.success || claims.data.purpose !== purpose) throw invalid();
  if (now.getTime() > claims.data.exp) {
    throw new AppError("bad-request", "This link has expired.");
  }
  return claims.data;
}
