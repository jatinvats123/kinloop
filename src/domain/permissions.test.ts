import { describe, expect, it } from "vitest";
import { makeMember } from "@/test/fixtures";
import { can, canManageMember, needsApproval, type Action } from "./permissions";

const elder = makeMember();
const priya = makeMember({
  id: "m-priya",
  name: "Priya",
  role: "family",
  access: "edit",
  isOrganiser: true,
});
const editor = makeMember({ id: "m-ed", role: "family", access: "edit", isOrganiser: false });
const ramesh = makeMember({
  id: "m-ramesh",
  name: "Ramesh",
  role: "caretaker",
  access: "view",
  isOrganiser: false,
});

const all: Action[] = [
  "view",
  "log-dose",
  "edit-schedule",
  "edit-profile",
  "edit-appointments",
  "manage-members",
  "change-settings",
  "follow-up",
];

describe("can", () => {
  it("gives the elder every permission", () => {
    for (const a of all) expect(can(elder, a)).toBe(true);
  });

  it("lets edit members change care but not circle settings", () => {
    expect(can(editor, "edit-schedule")).toBe(true);
    expect(can(editor, "log-dose")).toBe(true);
    expect(can(editor, "manage-members")).toBe(false);
    expect(can(editor, "change-settings")).toBe(false);
  });

  it("lets organisers with edit access manage members", () => {
    expect(can(priya, "manage-members")).toBe(true);
    expect(can({ ...priya, access: "view" }, "manage-members")).toBe(false);
  });

  it("keeps view members read-only apart from following up", () => {
    expect(can(ramesh, "view")).toBe(true);
    expect(can(ramesh, "follow-up")).toBe(true);
    for (const a of [
      "log-dose",
      "edit-schedule",
      "edit-profile",
      "edit-appointments",
      "manage-members",
    ] as const) {
      expect(can(ramesh, a)).toBe(false);
    }
  });
});

describe("canManageMember", () => {
  it("never lets anyone else change the elder", () => {
    expect(canManageMember(priya, elder)).toBe(false);
    expect(canManageMember(elder, elder)).toBe(true);
  });

  it("lets organisers manage other members", () => {
    expect(canManageMember(priya, ramesh)).toBe(true);
    expect(canManageMember(editor, ramesh)).toBe(false);
  });
});

describe("needsApproval", () => {
  it("turns other members' changes into proposals only when Ask me first is on", () => {
    expect(needsApproval(priya, { approvalRequired: true })).toBe(true);
    expect(needsApproval(elder, { approvalRequired: true })).toBe(false);
    expect(needsApproval(priya, { approvalRequired: false })).toBe(false);
  });
});
