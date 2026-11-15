import { beforeEach, describe, expect, it } from "vitest";
import { makeCircle, makeItem, makeLog, makeMember } from "@/test/fixtures";
import { AppError } from "@/server/errors";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import { signLink } from "@/server/security/signed-link";
import { confirmFromLink, followUpFromLink, readSlotLink } from "./links";

const SECRET = "test-link-secret-0123456789abcdef";
const SLOT = "2026-11-15T02:30:00.000Z"; // 08:00 IST
const CODE = "ACDEFGHJ";
const at = (min: number) => new Date(Date.parse(SLOT) + min * 60_000);

let repo: MemoryRepository;

const confirmToken = (over: Partial<Parameters<typeof signLink>[0]> = {}) =>
  signLink(
    { circle: CODE, slotAt: SLOT, memberId: "m-elder", purpose: "confirm", ...over },
    SECRET,
  );
const followToken = (memberId: string) =>
  signLink({ circle: CODE, slotAt: SLOT, memberId, purpose: "follow-up" }, SECRET);

async function code(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return e instanceof AppError ? e.code : "other";
  }
  return undefined;
}

beforeEach(async () => {
  repo = new MemoryRepository();
  await repo.createCircle({
    circle: makeCircle({ code: CODE }),
    members: [
      makeMember({ id: "m-elder" }),
      makeMember({ id: "m-priya", name: "Priya", role: "family", isOrganiser: false }),
      makeMember({
        id: "m-ramesh",
        name: "Ramesh",
        role: "caretaker",
        access: "view",
        isOrganiser: false,
      }),
    ],
    items: [
      makeItem({ id: "met" }),
      makeItem({ id: "aml", name: "Amlodipine", dose: "5 mg" }),
      makeItem({ id: "eve", name: "Atorvastatin", times: ["21:00"] }),
    ],
  });
  await repo.createCircle({ circle: makeCircle({ code: "OTHERCDE" }), members: [] });
});

describe("one-tap confirm", () => {
  it("shows the slot on GET without logging anything", async () => {
    const view = await readSlotLink(repo, confirmToken(), "confirm", SECRET, at(5));
    expect(view.state).toBe("ok");
    expect(view.time).toBe("8:00 AM");
    expect(view.items.map((i) => [i.name, i.logged])).toEqual([
      ["Metformin 500 mg", false],
      ["Amlodipine 5 mg", false],
    ]);
    expect(await repo.listLogs(CODE, SLOT, SLOT)).toEqual([]);
  });

  it("marks every open item in the slot taken on POST, once", async () => {
    await repo.putLogs(CODE, [makeLog({ itemId: "met", scheduledAt: SLOT })]);
    expect(await confirmFromLink(repo, confirmToken(), SECRET, at(5))).toEqual({ marked: 1 });
    expect(await confirmFromLink(repo, confirmToken(), SECRET, at(6))).toEqual({ marked: 0 });
    const logs = await repo.listLogs(CODE, SLOT, SLOT);
    expect(logs.map((l) => l.itemId).sort()).toEqual(["aml", "met"]);
    const [entry] = await repo.listActivity(CODE, 1);
    expect(entry?.actor).toBe("Kamla Devi");
  });

  it("refuses a tampered, expired, wrong-purpose or wrong-circle token", async () => {
    const good = confirmToken();
    expect(await code(confirmFromLink(repo, `${good}x`, SECRET, at(5)))).toBe("forbidden");
    expect(await code(confirmFromLink(repo, good, SECRET, at(13 * 60)))).toBe("bad-request");
    expect(await code(confirmFromLink(repo, followToken("m-elder"), SECRET, at(5)))).toBe(
      "forbidden",
    );
    // Validly signed, but for a circle where that member does not exist.
    expect(
      await code(confirmFromLink(repo, confirmToken({ circle: "OTHERCDE" }), SECRET, at(5))),
    ).toBe("forbidden");
    expect(await repo.listLogs(CODE, SLOT, SLOT)).toEqual([]);
  });

  it("reports expired and invalid links on GET", async () => {
    expect((await readSlotLink(repo, confirmToken(), "confirm", SECRET, at(13 * 60))).state).toBe(
      "expired",
    );
    expect((await readSlotLink(repo, "nonsense", "confirm", SECRET, at(5))).state).toBe("invalid");
  });

  it("refuses links for a demo circle that has expired", async () => {
    await repo.updateCircle(CODE, { isDemo: true, expiresAt: at(1).toISOString() });
    expect(await code(confirmFromLink(repo, confirmToken(), SECRET, at(5)))).toBe("forbidden");
  });

  it("does nothing when the slot no longer has items", async () => {
    for (const id of ["met", "aml"]) await repo.deleteItem(CODE, id);
    expect(await confirmFromLink(repo, confirmToken(), SECRET, at(5))).toEqual({ marked: 0 });
  });
});

describe("I'll check on them", () => {
  it("lets the first responder win under concurrent presses and tells the others", async () => {
    const [a, b] = await Promise.all([
      followUpFromLink(repo, followToken("m-priya"), SECRET, at(65)),
      followUpFromLink(repo, followToken("m-ramesh"), SECRET, at(65)),
    ]);
    expect([a?.mine, b?.mine].filter(Boolean)).toHaveLength(1);
    expect(a?.holder).toEqual(b?.holder);
    const later = await followUpFromLink(repo, followToken("m-ramesh"), SECRET, at(70));
    expect(later.holder.memberName).toBe(a?.holder.memberName);
    const activity = await repo.listActivity(CODE, 10);
    expect(activity.filter((e) => e.action === "follow-up.claimed")).toHaveLength(1);
  });

  it("does not repeat the activity when the same member presses twice", async () => {
    await followUpFromLink(repo, followToken("m-priya"), SECRET, at(65));
    const again = await followUpFromLink(repo, followToken("m-priya"), SECRET, at(66));
    expect(again.mine).toBe(true);
    const activity = await repo.listActivity(CODE, 10);
    expect(activity.filter((e) => e.action === "follow-up.claimed")).toHaveLength(1);
  });

  it("shows who is handling it on GET", async () => {
    await followUpFromLink(repo, followToken("m-priya"), SECRET, at(65));
    const view = await readSlotLink(repo, followToken("m-ramesh"), "follow-up", SECRET, at(66));
    expect(view.followUp?.memberName).toBe("Priya");
  });

  it("refuses confirm tokens and removed members", async () => {
    expect(await code(followUpFromLink(repo, confirmToken(), SECRET, at(65)))).toBe("forbidden");
    await repo.deleteMember(CODE, "m-priya");
    expect(await code(followUpFromLink(repo, followToken("m-priya"), SECRET, at(65)))).toBe(
      "forbidden",
    );
  });
});
