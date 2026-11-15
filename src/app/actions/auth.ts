"use server";
// Server actions for creating a circle, signing in and out, starting a demo and switching demo roles.
import { redirect } from "next/navigation";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import { clientKey, endSession, homeFor, readSession, startSession } from "@/server/auth/session";
import { getRepository } from "@/server/repositories";
import { createCircle, signIn, type CreatedCircle } from "@/server/services/circles";
import { createDemoCircle } from "@/server/services/demo";
import { formToObject } from "@/server/validation";

async function limit(scope: string, max: number, windowMs: number): Promise<void> {
  const repo = await getRepository();
  if (!(await repo.hitRateLimit(await clientKey(scope), max, windowMs, new Date()))) {
    throw new AppError(
      "rate-limited",
      "Too many attempts. Please wait a few minutes and try again.",
    );
  }
}

export async function signInAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  let home: string;
  try {
    await limit("signin", 20, 15 * 60_000);
    const repo = await getRepository();
    const { code, member } = await signIn(repo, formToObject(fd), new Date());
    await startSession(code, member);
    home = homeFor(member);
  } catch (err) {
    return toActionError(err);
  }
  redirect(home);
}

export async function createCircleAction(
  _prev: ActionResult<CreatedCircle>,
  fd: FormData,
): Promise<ActionResult<CreatedCircle>> {
  try {
    await limit("create", 5, 60 * 60_000);
    const repo = await getRepository();
    const now = new Date();
    const created = await createCircle(repo, formToObject(fd), now);
    const creator = await repo.getMember(created.code, created.creatorId);
    if (creator) await startSession(created.code, creator);
    return { ok: true, data: created };
  } catch (err) {
    return toActionError(err);
  }
}

export async function startDemoAction(): Promise<void> {
  const repo = await getRepository();
  if (!(await repo.hitRateLimit(await clientKey("demo"), 10, 60 * 60_000, new Date()))) {
    redirect("/?demo=busy");
  }
  const { code, elderId } = await createDemoCircle(repo, new Date());
  const elder = await repo.getMember(code, elderId);
  if (elder) await startSession(code, elder);
  redirect("/today");
}

/** True for a same-site path such as "/today" (never "//host" or a full URL). */
function isLocalPath(path: string): boolean {
  return /^\/[a-z][\w/-]*$/i.test(path);
}

export async function switchRoleAction(fd: FormData): Promise<void> {
  const ctx = await readSession();
  if (!ctx || !ctx.circle.isDemo) redirect("/sign-in");
  const target = await ctx.repo.getMember(ctx.circle.code, String(fd.get("memberId") ?? ""));
  if (!target) redirect(homeFor(ctx.member));
  await startSession(ctx.circle.code, target);
  const next = String(fd.get("next") ?? "");
  redirect(isLocalPath(next) ? next : homeFor(target));
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/sign-in");
}
