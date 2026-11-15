import { describe, expect, it } from "vitest";
import { makeCircle, makeItem, makeLog, makeMember } from "@/test/fixtures";
import { firestoreSettings } from "./firestore-repository";
import { MemoryRepository } from "./memory-repository";

const code = "ACDEFGHJ";

async function seeded() {
  const repo = new MemoryRepository();
  await repo.createCircle({
    circle: makeCircle({ code }),
    members: [makeMember()],
    items: [makeItem()],
  });
  return repo;
}

describe("MemoryRepository", () => {
  it("refuses to create a circle whose code is taken", async () => {
    const repo = await seeded();
    expect(await repo.createCircle({ circle: makeCircle({ code }), members: [] })).toBe(false);
  });

  it("returns copies so callers cannot mutate stored data", async () => {
    const repo = await seeded();
    const item = await repo.getItem(code, "met");
    if (item) item.name = "changed";
    expect((await repo.getItem(code, "met"))?.name).toBe("Metformin");
  });

  it("reads and writes every collection, scoped to the circle", async () => {
    const repo = await seeded();
    await repo.putItem(code, makeItem({ id: "b" }));
    await repo.deleteItem(code, "met");
    expect((await repo.listItems(code)).map((i) => i.id)).toEqual(["b"]);

    await repo.putMember(code, makeMember({ id: "m2", name: "Priya" }));
    await repo.deleteMember(code, "m-elder");
    expect((await repo.listMembers(code)).map((m) => m.id)).toEqual(["m2"]);
    expect(await repo.getMember(code, "nobody")).toBeNull();

    const at = "2026-11-14T02:30:00.000Z";
    await repo.putLogs(code, [makeLog({ itemId: "b", scheduledAt: at })]);
    expect(await repo.listLogs(code, at, at)).toHaveLength(1);
    expect(await repo.listLogs(code, "2026-11-15", "2026-11-16")).toHaveLength(0);
    await repo.deleteLog(code, `b_${at}`);
    expect(await repo.listLogs(code, at, at)).toHaveLength(0);

    const appt = {
      id: "a1",
      doctor: "Dr. Rao",
      specialty: "",
      location: "",
      notes: "",
      at: "2026-11-20T05:00:00.000Z",
    };
    await repo.putAppointment(code, appt);
    await repo.putAppointment(code, { ...appt, id: "a0", at: "2026-11-18T05:00:00.000Z" });
    expect((await repo.listAppointments(code, "2026-11-01", 5)).map((a) => a.id)).toEqual([
      "a0",
      "a1",
    ]);
    expect(await repo.getAppointment(code, "a1")).toEqual(appt);
    await repo.deleteAppointment(code, "a1");
    expect(await repo.getAppointment(code, "a1")).toBeNull();

    await repo.addActivity(code, {
      id: "x1",
      actorId: "m2",
      actor: "Priya",
      action: "a",
      summary: "first",
      at: "2026-11-14T01:00:00Z",
    });
    await repo.addActivity(code, {
      id: "x2",
      actorId: "m2",
      actor: "Priya",
      action: "a",
      summary: "second",
      at: "2026-11-14T02:00:00Z",
    });
    expect((await repo.listActivity(code, 1))[0]?.summary).toBe("second");

    expect(await repo.listItems("OTHERCOD")).toEqual([]);
    expect(await repo.getCircle("OTHERCOD")).toBeNull();
  });

  it("updates circles directly and transactionally", async () => {
    const repo = await seeded();
    await repo.updateCircle(code, { elderName: "Asha" });
    const before = await repo.transactCircle(code, (c) => ({
      login: { failures: c.login.failures + 1, lockedUntil: null },
    }));
    expect(before?.login.failures).toBe(0);
    expect((await repo.getCircle(code))?.login.failures).toBe(1);
    await repo.transactCircle(code, () => null);
    expect(await repo.transactCircle("OTHERCOD", () => null)).toBeNull();
    expect((await repo.getCircle(code))?.elderName).toBe("Asha");
  });

  it("lists only expired demo circles and deletes them", async () => {
    const repo = await seeded();
    await repo.createCircle({
      circle: makeCircle({ code: "DDDDDDDD", isDemo: true, expiresAt: "2026-11-14T00:00:00Z" }),
      members: [],
    });
    expect(await repo.listExpiredDemoCircles("2026-11-15T00:00:00Z", 10)).toEqual(["DDDDDDDD"]);
    await repo.deleteCircle("DDDDDDDD");
    expect(await repo.getCircle("DDDDDDDD")).toBeNull();
  });

  it("enforces a fixed-window rate limit", async () => {
    const repo = new MemoryRepository();
    const t0 = new Date("2026-11-14T00:00:00Z");
    expect(await repo.hitRateLimit("k", 2, 60_000, t0)).toBe(true);
    expect(await repo.hitRateLimit("k", 2, 60_000, t0)).toBe(true);
    expect(await repo.hitRateLimit("k", 2, 60_000, t0)).toBe(false);
    expect(await repo.hitRateLimit("k", 2, 60_000, new Date(t0.getTime() + 60_000))).toBe(true);
  });
});

describe("firestoreSettings", () => {
  it("decodes a base64 service-account key into client settings", () => {
    const key = Buffer.from(
      JSON.stringify({ project_id: "p", client_email: "e@p.iam", private_key: "k" }),
    ).toString("base64");
    expect(firestoreSettings(key)).toEqual({
      projectId: "p",
      credentials: { client_email: "e@p.iam", private_key: "k" },
      ignoreUndefinedProperties: true,
    });
  });
});
