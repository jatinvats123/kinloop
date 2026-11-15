import { beforeEach, describe, expect, it } from "vitest";
import { makeCircle, makeItem, makeMember } from "@/test/fixtures";
import type { Circle, Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import { MemoryMailer } from "@/server/email/mailer";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import type { Ctx } from "./context";
import { buildRemindersView, sendTestReminder } from "./reminders";

const CODE = "ACDEFGHJ";
const NOW = new Date("2026-11-15T01:30:00.000Z"); // 07:00 IST

let repo: MemoryRepository;
let mailer: MemoryMailer;

async function ctx(memberId = "m-priya", now = NOW): Promise<Ctx> {
  return {
    repo,
    circle: (await repo.getCircle(CODE)) as Circle,
    member: (await repo.getMember(CODE, memberId)) as Member,
    now,
  };
}

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
  mailer = new MemoryMailer();
  await repo.createCircle({
    circle: makeCircle({ code: CODE, isDemo: true }),
    members: [
      makeMember({ id: "m-elder" }),
      makeMember({ id: "m-priya", name: "Priya", role: "family", isOrganiser: false }),
    ],
    items: [makeItem({ id: "met", times: ["08:00", "20:00"] })],
  });
});

describe("sendTestReminder", () => {
  it("saves the member's email, turns reminders on for the circle and sends one email", async () => {
    await sendTestReminder(await ctx(), { email: " Priya@Example.com " }, mailer, "https://k.test");
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe("priya@example.com");
    expect((await repo.getMember(CODE, "m-priya"))?.email).toBe("priya@example.com");
    expect((await repo.getCircle(CODE))?.mailEnabled).toBe(true);
    const view = await buildRemindersView(await ctx());
    expect(view.sent.map((n) => [n.type, n.toName])).toEqual([["test", "Priya"]]);
    expect((await repo.listActivity(CODE, 1))[0]?.action).toBe("reminder.test");
  });

  it("allows three tests per member per hour", async () => {
    for (let i = 0; i < 3; i += 1) {
      await sendTestReminder(await ctx(), { email: "p@example.com" }, mailer, "https://k.test");
    }
    expect(
      await code(
        sendTestReminder(await ctx(), { email: "p@example.com" }, mailer, "https://k.test"),
      ),
    ).toBe("rate-limited");
  });

  it("rejects an invalid address", async () => {
    expect(
      await code(
        sendTestReminder(await ctx(), { email: "not-an-email" }, mailer, "https://k.test"),
      ),
    ).toBe("bad-request");
  });

  it("reports a mail failure without recording a sent reminder", async () => {
    mailer.failNext = 1;
    expect(
      await code(
        sendTestReminder(await ctx(), { email: "p@example.com" }, mailer, "https://k.test"),
      ),
    ).toBe("unavailable");
    expect((await buildRemindersView(await ctx())).sent).toEqual([]);
  });

  it("respects the circle's daily email cap", async () => {
    await repo.updateCircle(CODE, {
      quota: { aiDay: "", aiCount: 0, mailDay: "2026-11-15", mailCount: 60 },
    });
    expect(
      await code(
        sendTestReminder(await ctx(), { email: "p@example.com" }, mailer, "https://k.test"),
      ),
    ).toBe("rate-limited");
  });
});

describe("buildRemindersView", () => {
  it("says nothing is coming when nobody has an email", async () => {
    const view = await buildRemindersView(await ctx());
    expect(view).toMatchObject({ upcoming: [], anyEmail: false, myEmail: null });
  });

  it("lists the elder's upcoming dose emails once the elder has an email", async () => {
    const elder = (await repo.getMember(CODE, "m-elder")) as Member;
    await repo.putMember(CODE, { ...elder, email: "k@example.com" });
    const view = await buildRemindersView(await ctx());
    expect(view.upcoming.map((u) => [u.stage, u.toNames.join()])).toEqual([
      ["due", "Kamla Devi"],
      ["due", "Kamla Devi"],
    ]);
  });
});
