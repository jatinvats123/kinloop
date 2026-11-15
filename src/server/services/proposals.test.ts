import { beforeEach, describe, expect, it } from "vitest";
import type { Circle, Item, Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import { present } from "@/test/fixtures";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import { createCircle } from "./circles";
import type { Ctx } from "./context";
import { createDemoCircle } from "./demo";
import { createItem, deleteItem, setItemActive, updateItem } from "./items";
import { addMember } from "./members";
import {
  decideProposal,
  isProposal,
  listPendingProposals,
  propose,
  setApprovalRequired,
} from "./proposals";

const NOW = new Date("2026-11-14T03:00:00.000Z");
const medicine = {
  kind: "medicine",
  name: "Metformin",
  composition: "",
  dose: "500 mg",
  instructions: "After food",
  times: ["08:00"],
  daysOfWeek: ["0", "1", "2", "3", "4", "5", "6"],
  startDate: "2026-11-01",
  endDate: "",
};

let repo: MemoryRepository;
let code: string;

async function ctxFor(name: string): Promise<Ctx> {
  const circle = (await repo.getCircle(code)) as Circle;
  const member = (await repo.listMembers(code)).find((m) => m.name === name) as Member;
  return { repo, circle, member, now: NOW };
}

async function errCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return e instanceof AppError ? e.code : "other";
  }
  return undefined;
}

async function pendingIds(): Promise<string[]> {
  return (await listPendingProposals(await ctxFor("Kamla Devi"))).map((p) => p.id);
}

beforeEach(async () => {
  repo = new MemoryRepository();
  const created = await createCircle(
    repo,
    {
      elderName: "Kamla Devi",
      creatorRole: "family",
      creatorName: "Priya",
      timezone: "Asia/Kolkata",
    },
    NOW,
  );
  code = created.code;
  await addMember(await ctxFor("Priya"), {
    name: "Ramesh",
    role: "caretaker",
    email: "",
    access: "view",
  });
});

describe("Ask me first setting", () => {
  it("can be turned on and off only by the elder", async () => {
    expect(await errCode(setApprovalRequired(await ctxFor("Priya"), true))).toBe("forbidden");
    await setApprovalRequired(await ctxFor("Kamla Devi"), true);
    expect((await repo.getCircle(code))?.approvalRequired).toBe(true);
    await setApprovalRequired(await ctxFor("Kamla Devi"), false);
    expect((await repo.getCircle(code))?.approvalRequired).toBe(false);
    const actions = (await repo.listActivity(code, 5)).map((a) => a.action);
    expect(actions).toContain("settings.ask-first-on");
    expect(actions).toContain("settings.ask-first-off");
  });
});

describe("with Ask me first on", () => {
  let item: Item;

  beforeEach(async () => {
    item = (await createItem(await ctxFor("Priya"), medicine)) as Item;
    await setApprovalRequired(await ctxFor("Kamla Devi"), true);
  });

  it("turns another member's add, edit, pause and delete into proposals", async () => {
    const priya = await ctxFor("Priya");
    expect(isProposal(await createItem(priya, { ...medicine, name: "Amlodipine" }))).toBe(true);
    expect(isProposal(await updateItem(priya, item.id, { ...medicine, dose: "1000 mg" }))).toBe(
      true,
    );
    expect(await setItemActive(priya, item.id, false)).not.toBeNull();
    expect(await deleteItem(priya, item.id)).not.toBeNull();
    const items = await repo.listItems(code);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ dose: "500 mg", active: true });
    expect(await pendingIds()).toHaveLength(4);
    const [latest] = await repo.listActivity(code, 1);
    expect(latest?.summary).toBe("Proposed: remove Metformin 500 mg (waiting for Kamla's OK)");
  });

  it("still lets the elder change things directly", async () => {
    const kamla = await ctxFor("Kamla Devi");
    expect(isProposal(await createItem(kamla, { ...medicine, name: "Amlodipine" }))).toBe(false);
    expect(await setItemActive(kamla, item.id, false)).toBeNull();
    expect(await pendingIds()).toEqual([]);
  });

  it("still refuses view-only members", async () => {
    expect(await errCode(createItem(await ctxFor("Ramesh"), medicine))).toBe("forbidden");
  });

  it("applies an approved add, edit, pause and removal exactly as proposed", async () => {
    const priya = await ctxFor("Priya");
    const kamla = await ctxFor("Kamla Devi");
    const add = await createItem(priya, { ...medicine, name: "Amlodipine", dose: "5 mg" });
    await decideProposal(kamla, add.id, "approved");
    expect((await repo.listItems(code)).map((i) => i.name).sort()).toEqual([
      "Amlodipine",
      "Metformin",
    ]);

    const edit = await updateItem(priya, item.id, {
      ...medicine,
      dose: "1000 mg",
      times: ["09:00"],
    });
    await decideProposal(kamla, edit.id, "approved");
    expect(await repo.getItem(code, item.id)).toMatchObject({ dose: "1000 mg", times: ["09:00"] });

    const pause = present(await setItemActive(priya, item.id, false), "pause proposal");
    await decideProposal(kamla, pause.id, "approved");
    expect((await repo.getItem(code, item.id))?.active).toBe(false);

    const remove = present(await deleteItem(priya, item.id), "remove proposal");
    await decideProposal(kamla, remove.id, "approved");
    expect(await repo.getItem(code, item.id)).toBeNull();
    expect(await pendingIds()).toEqual([]);
    const [latest] = await repo.listActivity(code, 1);
    expect(latest).toMatchObject({ actor: "Kamla Devi", action: "proposal.approved" });
  });

  it("leaves the schedule untouched when the elder declines", async () => {
    const p = await updateItem(await ctxFor("Priya"), item.id, { ...medicine, dose: "1000 mg" });
    await decideProposal(await ctxFor("Kamla Devi"), p.id, "declined");
    expect((await repo.getItem(code, item.id))?.dose).toBe("500 mg");
    expect((await repo.getProposal(code, p.id))?.status).toBe("declined");
  });

  it("never lets a member approve their own proposal, or anyone but the elder decide", async () => {
    const p = await createItem(await ctxFor("Priya"), { ...medicine, name: "Amlodipine" });
    expect(await errCode(decideProposal(await ctxFor("Priya"), p.id, "approved"))).toBe(
      "forbidden",
    );
    expect(await errCode(decideProposal(await ctxFor("Ramesh"), p.id, "approved"))).toBe(
      "forbidden",
    );
    expect(await pendingIds()).toEqual([p.id]);
  });

  it("refuses to decide twice or decide an unknown proposal", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const p = await createItem(await ctxFor("Priya"), { ...medicine, name: "Amlodipine" });
    await decideProposal(kamla, p.id, "approved");
    expect(await errCode(decideProposal(kamla, p.id, "approved"))).toBe("conflict");
    expect(await errCode(decideProposal(kamla, "nope", "declined"))).toBe("conflict");
    expect(await repo.listItems(code)).toHaveLength(2);
  });

  it("declines an approval whose item was deleted in the meantime", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const p = await updateItem(await ctxFor("Priya"), item.id, { ...medicine, dose: "1000 mg" });
    await deleteItem(kamla, item.id);
    expect(await errCode(decideProposal(kamla, p.id, "approved"))).toBe("conflict");
    expect((await repo.getProposal(code, p.id))?.status).toBe("declined");
  });

  it("caps the number of pending proposals", async () => {
    const priya = await ctxFor("Priya");
    for (let i = 0; i < 20; i += 1) await propose(priya, "remove", item.id, null, `remove ${i}`);
    expect(await errCode(propose(priya, "remove", item.id, null, "one more"))).toBe("conflict");
  });
});

describe("demo seed", () => {
  it("starts with Ask me first on and Priya's proposal waiting for Kamla", async () => {
    const demo = await createDemoCircle(repo, NOW);
    expect((await repo.getCircle(demo.code))?.approvalRequired).toBe(true);
    const [p] = await repo.listProposals(demo.code, "pending", 5);
    expect(p).toMatchObject({ kind: "add", proposedByName: "Priya" });
    code = demo.code;
    await decideProposal(await ctxFor("Kamla Devi"), present(p, "proposal").id, "approved");
    expect((await repo.listItems(demo.code)).some((i) => i.name === "Vitamin D3")).toBe(true);
  });
});
