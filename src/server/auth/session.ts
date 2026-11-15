// Session cookie handling and the central `requireSession` guard used by every signed-in page and action.
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { auth } from "@/domain/config";
import type { Member } from "@/domain/types";
import { env } from "@/server/env";
import { getRepository } from "@/server/repositories";
import type { Ctx } from "@/server/services/context";
import { sessionVersion, signSession, verifySession } from "./session-token";

export const SESSION_COOKIE = "kl_session";

/** Issues the signed, httpOnly session cookie for `member` of circle `code`. */
export async function startSession(code: string, member: Member): Promise<void> {
  const token = await signSession(
    { code, memberId: member.id, version: sessionVersion(member.passcodeHash) },
    env().SESSION_SECRET,
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: auth.sessionHours * 3600,
  });
}

/** Removes the session cookie. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Loads the signed-in member and their circle, or null. The circle code always comes from the
 * signed token, never from client input; removed members, regenerated passcodes and expired demo
 * circles all invalidate the session.
 */
export async function readSession(now = new Date()): Promise<Ctx | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token, env().SESSION_SECRET, now);
  if (!claims) return null;
  const repo = await getRepository();
  const [circle, member] = await Promise.all([
    repo.getCircle(claims.code),
    repo.getMember(claims.code, claims.memberId),
  ]);
  if (!circle || !member) return null;
  if (sessionVersion(member.passcodeHash) !== claims.version) return null;
  if (circle.expiresAt && circle.expiresAt < now.toISOString()) return null;
  return { repo, circle, member, now };
}

/** Guard for signed-in pages and actions: returns the context or redirects to sign-in. */
export async function requireSession(): Promise<Ctx> {
  const ctx = await readSession();
  if (!ctx) redirect("/sign-in");
  return ctx;
}

/** Where a member lands after signing in: the elder on Today, everyone else on the overview. */
export function homeFor(member: Pick<Member, "role">): string {
  return member.role === "elder" ? "/today" : "/overview";
}

/** Privacy-preserving rate-limit key for the caller: a salted hash of their IP, never the IP itself. */
export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const digest = createHash("sha256").update(`${env().LINK_SECRET}:${ip}`).digest("base64url");
  return `${scope}-${digest.slice(0, 22)}`;
}
