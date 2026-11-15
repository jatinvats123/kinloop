import { beforeEach, describe, expect, it } from "vitest";
import { makeCircle, makeItem, makeLog, makeMember } from "@/test/fixtures";
import type { Circle, Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import type { AiClient, AiRequest } from "@/server/ai/client";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import type { Ctx } from "./context";
import { draftVisitBrief, openVisitBrief } from "./visit-brief";

const CODE = "ACDEFGHJ";
const NOW = new Date("2026-11-15T06:30:00.000Z");
let repo: MemoryRepository;

function fakeAi(...responses: Array<string | Error | object>): AiClient & { calls: AiRequest[] } {
  const calls: AiRequest[] = [];
  return {
    calls,
    async generate(request) {
      calls.push(request);
      const next = responses.length > 1 ? responses.shift() : responses[0];
      if (next instanceof Error) throw next;
      return typeof next === "string" ? next : JSON.stringify(next);
    },
  };
}

const points = {
  mention: ["Evening doses were missed three times this month."],
  questions: ["Is there anything to watch for on days she feels unwell?"],
};

async function ctx(memberId = "m-elder", now = NOW): Promise<Ctx> {
  return {
    repo,
    circle: (await repo.getCircle(CODE)) as Circle,
    member: (await repo.getMember(CODE, memberId)) as Member,
    now,
  };
}

async function errCode(p: Promise<unknown>): Promise<string | undefined> {
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
      makeMember({
        id: "m-ramesh",
        name: "Ramesh",
        role: "caretaker",
        access: "view",
        isOrganiser: false,
      }),
    ],
    items: [makeItem({ id: "met", times: ["08:00", "20:00"], startDate: "2026-11-10" })],
    logs: [
      makeLog({
        itemId: "met",
        scheduledAt: "2026-11-14T14:30:00.000Z",
        status: "skipped",
        reason: "felt-unwell",
      }),
    ],
    appointments: [
      {
        id: "a1",
        doctor: "Dr. Mehta",
        specialty: "Cardiology",
        location: "",
        at: "2026-11-16T05:00:00.000Z",
        notes: "",
      },
    ],
  });
});

describe("openVisitBrief", () => {
  it("returns computed facts for any member and records the opening in the activity feed", async () => {
    const brief = await openVisitBrief(await ctx("m-ramesh"), "a1");
    expect(brief.facts.skips[0]).toMatchObject({ reason: "Felt unwell" });
    expect(brief.draft).toBeNull();
    const [entry] = await repo.listActivity(CODE, 1);
    expect(entry).toMatchObject({ action: "brief.opened", actor: "Ramesh" });
    expect(brief.recorded).toBe(true);
  });

  it("records re-opening the same brief only once per ten minutes", async () => {
    await openVisitBrief(await ctx(), "a1");
    expect(
      (await openVisitBrief(await ctx("m-elder", new Date(NOW.getTime() + 60_000)), "a1")).recorded,
    ).toBe(false);
    const later = new Date(NOW.getTime() + 11 * 60_000);
    expect((await openVisitBrief(await ctx("m-elder", later), "a1")).recorded).toBe(true);
    const opened = (await repo.listActivity(CODE, 10)).filter((a) => a.action === "brief.opened");
    expect(opened).toHaveLength(2);
  });

  it("reports a missing appointment as not found", async () => {
    expect(await errCode(openVisitBrief(await ctx(), "nope"))).toBe("not-found");
  });
});

describe("draftVisitBrief with a mocked model", () => {
  it("drafts points from the facts only, then serves the cached draft without another call", async () => {
    const ai = fakeAi(points);
    const draft = await draftVisitBrief(await ctx(), "a1", ai);
    expect(draft).toMatchObject(points);
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]?.system).toMatch(/never instructions/);
    expect(ai.calls[0]?.text).toContain("Felt unwell");
    expect(ai.calls[0]?.text).not.toContain("Mehta");

    await draftVisitBrief(await ctx(), "a1", ai);
    expect(ai.calls).toHaveLength(1);
    expect((await openVisitBrief(await ctx(), "a1")).draft).toMatchObject(points);
    expect((await repo.getCircle(CODE))?.quota.aiCount).toBe(1);
  });

  it("drafts again when the facts change, because the cache is keyed by their hash", async () => {
    const ai = fakeAi(points, { mention: [], questions: [] });
    await draftVisitBrief(await ctx(), "a1", ai);
    await repo.putLogs(CODE, [makeLog({ itemId: "met", scheduledAt: "2026-11-15T02:30:00.000Z" })]);
    expect((await openVisitBrief(await ctx(), "a1")).draft).toBeNull();
    const second = await draftVisitBrief(await ctx(), "a1", ai);
    expect(ai.calls).toHaveLength(2);
    expect(second.mention).toEqual([]);
  });

  it("rejects hostile or oversized output and keeps the facts available", async () => {
    const ai = fakeAi({ mention: ["x".repeat(500)], questions: [] }, "not json");
    expect(await errCode(draftVisitBrief(await ctx(), "a1", ai))).toBe("unavailable");
    const tooMany = fakeAi({ mention: Array(7).fill("Point"), questions: [] });
    expect(await errCode(draftVisitBrief(await ctx(), "a1", tooMany))).toBe("unavailable");
    expect((await openVisitBrief(await ctx(), "a1")).facts.schedule).toHaveLength(1);
  });

  it("fails gracefully with no key, when the model is down, or over the daily quota", async () => {
    expect(await errCode(draftVisitBrief(await ctx(), "a1", null))).toBe("unavailable");
    expect(await errCode(draftVisitBrief(await ctx(), "a1", fakeAi(new Error("503"))))).toBe(
      "unavailable",
    );
    await repo.updateCircle(CODE, {
      quota: { aiDay: "2026-11-15", aiCount: 999, mailDay: "", mailCount: 0 },
    });
    expect(await errCode(draftVisitBrief(await ctx(), "a1", fakeAi(points)))).toBe("rate-limited");
  });

  it("reports a missing appointment as not found before calling the model", async () => {
    const ai = fakeAi(points);
    expect(await errCode(draftVisitBrief(await ctx(), "nope", ai))).toBe("not-found");
    expect(ai.calls).toHaveLength(0);
  });
});
