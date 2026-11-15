// Circle members: add, update access and alerts, remove, regenerate passcodes; and the health profile.
import { limits } from "@/domain/config";
import { canManageMember } from "@/domain/permissions";
import type { Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import { hashPasscode, newPasscode } from "@/server/auth/passcode";
import {
  elderUpdateSchema,
  memberSchema,
  memberUpdateSchema,
  profileSchema,
} from "@/server/validation";
import { newMemberRecord } from "./circles";
import { parseInput, recordActivity, requirePermission, type Ctx } from "./context";

async function loadMember(ctx: Ctx, id: string): Promise<Member> {
  const m = await ctx.repo.getMember(ctx.circle.code, id);
  if (!m) throw new AppError("not-found", "That member isn't in this circle.");
  return m;
}

/** Demo circles only: keep the demo panel's sign-in details current. Real circles never store passcodes. */
async function rememberDemoPasscode(ctx: Ctx, memberId: string, passcode: string): Promise<void> {
  if (!ctx.circle.isDemo || !ctx.circle.demoAccess) return;
  await ctx.repo.updateCircle(ctx.circle.code, {
    demoAccess: { ...ctx.circle.demoAccess, [memberId]: passcode },
  });
}

/** Keeps `circle.mailEnabled` in step with whether anyone has an email, so the cron tick visits it. */
export async function syncMailFlag(ctx: Pick<Ctx, "repo" | "circle">): Promise<void> {
  const members = await ctx.repo.listMembers(ctx.circle.code);
  const mailEnabled = members.some((m) => Boolean(m.email));
  if (Boolean(ctx.circle.mailEnabled) !== mailEnabled) {
    await ctx.repo.updateCircle(ctx.circle.code, { mailEnabled });
  }
}

/** Adds a family member or caretaker; returns their passcode, shown once. */
export async function addMember(
  ctx: Ctx,
  input: unknown,
): Promise<{ member: Member; passcode: string }> {
  requirePermission(ctx, "manage-members");
  const d = parseInput(memberSchema, input);
  const existing = await ctx.repo.listMembers(ctx.circle.code);
  if (existing.length >= limits.maxMembers)
    throw new AppError("conflict", `A circle can have up to ${limits.maxMembers} members.`);
  const created = await newMemberRecord(
    {
      name: d.name,
      role: d.role,
      email: d.email,
      access: d.access,
      isOrganiser: d.isOrganiser,
      alerts: { missed: d.alertMissed, appointments: d.alertAppointments },
    },
    ctx.now,
  );
  await ctx.repo.putMember(ctx.circle.code, created.member);
  await rememberDemoPasscode(ctx, created.member.id, created.passcode);
  await syncMailFlag(ctx);
  await recordActivity(ctx, "member.added", `Added ${d.name} as ${d.role} with ${d.access} access`);
  return created;
}

/** Updates a member's details, access and alert choices. The elder's own record only by the elder. */
export async function updateMember(ctx: Ctx, memberId: string, input: unknown): Promise<void> {
  const target = await loadMember(ctx, memberId);
  const isSelf = target.id === ctx.member.id;
  if (target.role === "elder") {
    if (!isSelf) throw new AppError("forbidden", "Only the elder can change their own details.");
    const d = parseInput(elderUpdateSchema, input);
    await ctx.repo.putMember(ctx.circle.code, {
      ...target,
      email: d.email,
      alerts: { missed: d.alertMissed, appointments: d.alertAppointments },
    });
    await syncMailFlag(ctx);
    await recordActivity(ctx, "member.updated", "Updated their contact and alert choices");
    return;
  }
  if (!canManageMember(ctx.member, target) && !isSelf) {
    throw new AppError("forbidden", "You don't have permission to do that.");
  }
  const d = parseInput(memberUpdateSchema, input);
  const managing = canManageMember(ctx.member, target);
  await ctx.repo.putMember(ctx.circle.code, {
    ...target,
    name: d.name,
    email: d.email,
    alerts: { missed: d.alertMissed, appointments: d.alertAppointments },
    // Only managers may change access or organiser status, so nobody can promote themselves.
    access: managing ? d.access : target.access,
    isOrganiser: managing ? d.isOrganiser : target.isOrganiser,
  });
  await syncMailFlag(ctx);
  await recordActivity(ctx, "member.updated", `Updated ${d.name}'s details`);
}

/** Removes a member. The elder can never be removed, and members cannot remove themselves. */
export async function removeMember(ctx: Ctx, memberId: string): Promise<void> {
  const target = await loadMember(ctx, memberId);
  if (target.role === "elder")
    throw new AppError("forbidden", "The elder can't be removed from their own circle.");
  if (target.id === ctx.member.id)
    throw new AppError("forbidden", "Ask an organiser to remove you.");
  if (!canManageMember(ctx.member, target))
    throw new AppError("forbidden", "You don't have permission to do that.");
  await ctx.repo.deleteMember(ctx.circle.code, memberId);
  await syncMailFlag(ctx);
  await recordActivity(ctx, "member.removed", `Removed ${target.name} from the circle`);
}

/** Issues a new passcode for yourself, or for a member you manage; old sessions stop working. */
export async function regeneratePasscode(
  ctx: Ctx,
  memberId: string,
): Promise<{ name: string; passcode: string }> {
  const target = await loadMember(ctx, memberId);
  if (target.id !== ctx.member.id && !canManageMember(ctx.member, target)) {
    throw new AppError("forbidden", "You don't have permission to do that.");
  }
  const passcode = newPasscode();
  const { hash, salt } = await hashPasscode(passcode);
  await ctx.repo.putMember(ctx.circle.code, { ...target, passcodeHash: hash, salt });
  await rememberDemoPasscode(ctx, target.id, passcode);
  await recordActivity(ctx, "passcode.regenerated", `Issued a new passcode for ${target.name}`);
  return { name: target.name, passcode };
}

/** Saves the health profile (conditions, allergies, blood group, doctor, emergency contact). */
export async function updateProfile(ctx: Ctx, input: unknown): Promise<void> {
  requirePermission(ctx, "edit-profile");
  const d = parseInput(profileSchema, input);
  await ctx.repo.updateCircle(ctx.circle.code, {
    profile: {
      conditions: d.conditions,
      allergies: d.allergies,
      bloodGroup: d.bloodGroup,
      primaryDoctor: d.primaryDoctor,
      emergencyContact: { name: d.emergencyName, phone: d.emergencyPhone },
    },
  });
  await recordActivity(ctx, "profile.updated", "Updated the health profile");
}
