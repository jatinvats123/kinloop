// Creating a circle and signing in with circle code + passcode (with lockout after repeated failures).
import { auth } from "@/domain/config";
import { formatCircleCode, parseCircleCode } from "@/domain/codes";
import type { Circle, Member, Role } from "@/domain/types";
import { AppError } from "@/server/errors";
import {
  hashPasscode,
  newCircleCode,
  newId,
  newPasscode,
  verifyPasscode,
} from "@/server/auth/passcode";
import type { Repository } from "@/server/repositories/repository";
import { createCircleSchema, signInSchema } from "@/server/validation";
import { parseInput } from "./context";

const GENERIC_SIGN_IN_ERROR = "That circle code and passcode don't match.";

export function emptyProfile(): Circle["profile"] {
  return {
    conditions: [],
    allergies: [],
    bloodGroup: "",
    primaryDoctor: "",
    emergencyContact: { name: "", phone: "" },
  };
}

export function newCircleRecord(
  code: string,
  elderName: string,
  timezone: string,
  now: Date,
): Circle {
  return {
    code,
    elderName,
    timezone,
    approvalRequired: false,
    isDemo: false,
    expiresAt: null,
    createdAt: now.toISOString(),
    profile: emptyProfile(),
    login: { failures: 0, lockedUntil: null },
    quota: { aiDay: "", aiCount: 0, mailDay: "", mailCount: 0 },
  };
}

/** Builds a member record with a freshly hashed passcode; returns the plain passcode once. */
export async function newMemberRecord(
  fields: Pick<Member, "name" | "role" | "email" | "access" | "isOrganiser" | "alerts">,
  now: Date,
): Promise<{ member: Member; passcode: string }> {
  const passcode = newPasscode();
  const { hash, salt } = await hashPasscode(passcode);
  return {
    passcode,
    member: {
      id: newId(),
      ...fields,
      passcodeHash: hash,
      salt,
      prefs: { textSize: "normal", lang: "en" },
      createdAt: now.toISOString(),
    },
  };
}

export interface CreatedCircle {
  code: string;
  displayCode: string;
  people: Array<{ memberId: string; name: string; role: Role; passcode: string }>;
  creatorId: string;
}

/**
 * Creates a care circle. The elder always gets a member record; when someone else creates the
 * circle they become an organiser with edit access. Passcodes are returned once, never stored.
 */
export async function createCircle(
  repo: Repository,
  input: unknown,
  now: Date,
): Promise<CreatedCircle> {
  const data = parseInput(createCircleSchema, input);
  const people: CreatedCircle["people"] = [];
  const elder = await newMemberRecord(
    {
      name: data.elderName,
      role: "elder",
      email: null,
      access: "edit",
      isOrganiser: true,
      alerts: { missed: true, appointments: true },
    },
    now,
  );
  const members = [elder.member];
  people.push({
    memberId: elder.member.id,
    name: data.elderName,
    role: "elder",
    passcode: elder.passcode,
  });
  let creatorId = elder.member.id;

  if (data.creatorRole !== "elder") {
    if (!data.creatorName)
      throw new AppError("bad-request", "Please check the highlighted fields.", {
        creatorName: "Enter your name",
      });
    const creator = await newMemberRecord(
      {
        name: data.creatorName,
        role: data.creatorRole,
        email: null,
        access: "edit",
        isOrganiser: true,
        alerts: { missed: true, appointments: true },
      },
      now,
    );
    members.push(creator.member);
    people.push({
      memberId: creator.member.id,
      name: data.creatorName,
      role: data.creatorRole,
      passcode: creator.passcode,
    });
    creatorId = creator.member.id;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCircleCode();
    const circle = newCircleRecord(code, data.elderName, data.timezone, now);
    const creatorName = members.find((m) => m.id === creatorId)?.name ?? data.elderName;
    const created = await repo.createCircle({
      circle,
      members,
      activity: [
        {
          id: `${now.getTime().toString(36)}-${newId()}`,
          actorId: creatorId,
          actor: creatorName,
          action: "circle.created",
          summary: `Created the care circle for ${data.elderName}`,
          at: now.toISOString(),
        },
      ],
    });
    if (created) return { code, displayCode: formatCircleCode(code), people, creatorId };
  }
  throw new AppError("unavailable", "Couldn't create a circle right now. Please try again.");
}

/**
 * Signs in with circle code + passcode. Five failures lock the circle's sign-in for 15 minutes.
 * Errors are deliberately generic so they reveal nothing about which part was wrong.
 */
export async function signIn(
  repo: Repository,
  input: unknown,
  now: Date,
): Promise<{ code: string; member: Member }> {
  const data = parseInput(signInSchema, input);
  const code = parseCircleCode(data.code);
  if (!code) throw new AppError("unauthorised", GENERIC_SIGN_IN_ERROR);
  const circle = await repo.getCircle(code);
  if (!circle) throw new AppError("unauthorised", GENERIC_SIGN_IN_ERROR);
  if (circle.expiresAt && circle.expiresAt < now.toISOString())
    throw new AppError("unauthorised", GENERIC_SIGN_IN_ERROR);
  if (circle.login.lockedUntil && circle.login.lockedUntil > now.toISOString()) {
    throw new AppError("locked", "Too many attempts. Please wait 15 minutes and try again.");
  }

  const members = await repo.listMembers(code);
  let match: Member | null = null;
  for (const m of members) {
    if (await verifyPasscode(data.passcode, m.passcodeHash, m.salt)) match = m;
  }

  if (!match) {
    await repo.transactCircle(code, (c) => {
      const failures = c.login.failures + 1;
      return failures >= auth.maxFailures
        ? {
            login: {
              failures: 0,
              lockedUntil: new Date(now.getTime() + auth.lockoutMin * 60_000).toISOString(),
            },
          }
        : { login: { failures, lockedUntil: c.login.lockedUntil } };
    });
    throw new AppError("unauthorised", GENERIC_SIGN_IN_ERROR);
  }

  if (circle.login.failures > 0 || circle.login.lockedUntil) {
    await repo.updateCircle(code, { login: { failures: 0, lockedUntil: null } });
  }
  return { code, member: match };
}
