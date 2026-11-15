// The single permission function used by every service. The elder always has full control.
import type { Circle, Member } from "./types";

export type Action =
  | "view"
  | "log-dose"
  | "edit-schedule"
  | "edit-profile"
  | "edit-appointments"
  | "manage-members"
  | "change-settings"
  | "follow-up";

type Actor = Pick<Member, "role" | "access" | "isOrganiser">;

/**
 * Whether `member` may perform `action` in `circle`.
 * - elder: everything;
 * - `edit` access: log doses, edit schedule, profile and appointments;
 * - organisers with `edit` access: also manage members;
 * - `view` access: read and say "I'll check on her";
 * - circle settings (such as "Ask me first") belong to the elder alone.
 */
export function can(
  member: Actor,
  action: Action,
  _circle?: Pick<Circle, "approvalRequired">,
): boolean {
  if (member.role === "elder") return true;
  switch (action) {
    case "view":
    case "follow-up":
      return true;
    case "log-dose":
    case "edit-schedule":
    case "edit-profile":
    case "edit-appointments":
      return member.access === "edit";
    case "manage-members":
      return member.isOrganiser && member.access === "edit";
    case "change-settings":
      return false;
  }
}

/**
 * Whether `actor` may change or remove `target`: requires member management, and nobody but
 * the elder can change the elder's own record.
 */
export function canManageMember(
  actor: Actor & Pick<Member, "id">,
  target: Pick<Member, "id" | "role">,
): boolean {
  if (target.role === "elder") return actor.role === "elder" && actor.id === target.id;
  return can(actor, "manage-members");
}

/**
 * Whether a schedule change by `member` must become a proposal for the elder to approve
 * ("Ask me first").
 */
export function needsApproval(
  member: Pick<Member, "role">,
  circle: Pick<Circle, "approvalRequired">,
): boolean {
  return circle.approvalRequired && member.role !== "elder";
}
