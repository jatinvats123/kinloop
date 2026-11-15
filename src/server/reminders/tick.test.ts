import { beforeEach, describe, expect, it } from "vitest";
import { notificationKey } from "@/domain/reminders";
import { makeCircle, makeItem, makeLog, makeMember } from "@/test/fixtures";
import { MemoryMailer } from "@/server/email/mailer";
import { reserveMail } from "@/server/email/quota";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import { verifyLink } from "@/server/security/signed-link";
import { syncMailFlag } from "@/server/services/members";
import { mapLimit } from "@/server/concurrency";
import { processCircle, runTick, type TickDeps } from "./tick";

const SECRET = "test-link-secret-0123456789abcdef";
const SLOT = "2026-11-15T02:30:00.000Z"; // 08:00 IST
const at = (min: number) => new Date(Date.parse(SLOT) + min * 60_000);
const CODE = "ACDEFGHJ";

let repo: MemoryRepository;
let mailer: MemoryMailer;

const deps = (now: Date, over: Partial<TickDeps> = {}): TickDeps => ({
  repo,
  mailer,
  now,
  linkSecret: SECRET,
  appUrl: "https://kinloop.test/",
  ...over,
});

beforeEach(async () => {
  repo = new MemoryRepository();
  mailer = new MemoryMailer();
  await repo.createCircle({
    circle: makeCircle({ code: CODE, mailEnabled: true }),
    members: [
      makeMember({ id: "m-elder", email: "kamla@example.com" }),
      makeMember({
        id: "m-priya",
        name: "Priya <script>",
        role: "family",
        isOrganiser: false,
        email: "priya@example.com",
      }),
    ],
    items: [makeItem({ id: "met", instructions: "After <b>breakfast</b>" })],
    appointments: [
      {
        id: "a1",
        doctor: "Dr Mehta",
        specialty: "Cardiology",
        location: "City Clinic",
        at: at(23 * 60).toISOString(),
        notes: "",
      },
    ],
  });
});

describe("runTick", () => {
  it("sends the due email with a one-tap confirm link and the 24-hour appointment reminder", async () => {
    const result = await runTick(deps(at(-5)));
    expect(result).toMatchObject({ circles: 1, sent: 3, failed: 0, capped: 0 });
    const due = mailer.sent.find(
      (m) => m.to === "kamla@example.com" && /medicines/.test(m.subject),
    );
    expect(due?.subject).toBe("Time for your 8:00 AM medicines");
    const link = /https:\/\/kinloop\.test\/confirm\?t=([\w.-]+)/.exec(due?.text ?? "")?.[1];
    expect(link).toBeDefined();
    const claims = verifyLink(link as string, "confirm", SECRET, at(0));
    expect(claims).toMatchObject({ circle: CODE, slotAt: SLOT, memberId: "m-elder" });
    expect(mailer.sent.filter((m) => /Appointment tomorrow/.test(m.subject))).toHaveLength(2);
  });

  it("is idempotent: a repeated tick sends nothing new", async () => {
    await runTick(deps(at(-5)));
    const again = await runTick(deps(at(-4)));
    expect(again.sent).toBe(0);
    expect(mailer.sent).toHaveLength(3);
  });

  it("escapes member content in HTML", async () => {
    await runTick(deps(at(-5)));
    const due = mailer.sent.find(
      (m) => m.to === "kamla@example.com" && /medicines/.test(m.subject),
    );
    expect(due?.html).toContain("After &lt;b&gt;breakfast&lt;/b&gt;");
    expect(due?.html).not.toContain("<b>breakfast");
  });

  it("escalates to the circle with a follow-up link after the elder's nudge", async () => {
    await runTick(deps(at(35)));
    await runTick(deps(at(61)));
    const esc = mailer.sent.find(
      (m) => m.to === "priya@example.com" && /hasn't marked/.test(m.subject),
    );
    expect(esc?.subject).toBe("Kamla Devi hasn't marked the 8:00 AM medicines");
    expect(esc?.text).toMatch(/\/check-on\?t=/);
    expect(esc?.html).toContain("Priya &lt;script&gt;");
  });

  it("sends nothing once the slot is logged", async () => {
    await repo.putLogs(CODE, [makeLog({ itemId: "met", scheduledAt: SLOT })]);
    await runTick(deps(at(35)));
    expect(mailer.sent.filter((m) => /medicines/.test(m.subject))).toEqual([]);
  });

  it("releases the claim when sending fails so the next tick retries", async () => {
    mailer.failNext = 1;
    const first = await processCircle(deps(at(-5)), CODE);
    expect(first.failed).toBe(1);
    const retry = await processCircle(deps(at(-4)), CODE);
    expect(retry.sent).toBe(1);
    expect(mailer.sent.filter((m) => /Time for your/.test(m.subject))).toHaveLength(1);
  });

  it("never resends an email an earlier tick already claimed", async () => {
    const key = notificationKey(SLOT, "due", "m-elder");
    await repo.claimNotification(CODE, {
      id: key,
      type: "due",
      to: "m-elder",
      at: SLOT,
      sentAt: at(-6).toISOString(),
      itemCount: 1,
    });
    const result = await processCircle(deps(at(-5)), CODE);
    expect(mailer.sent.filter((m) => /Time for your/.test(m.subject))).toEqual([]);
    expect(result.sent).toBe(2);
  });

  it("stops at the circle's daily email cap", async () => {
    await repo.updateCircle(CODE, {
      quota: { aiDay: "", aiCount: 0, mailDay: "2026-11-15", mailCount: 59 },
    });
    const result = await runTick(deps(at(-5)));
    expect(result).toMatchObject({ sent: 1, capped: 2 });
  });

  it("skips circles without email and stops starting circles after the time budget", async () => {
    await repo.updateCircle(CODE, { mailEnabled: false });
    expect((await runTick(deps(at(-5)))).circles).toBe(0);
    await repo.updateCircle(CODE, { mailEnabled: true });
    expect((await runTick(deps(at(-5), { budgetMs: -1 }))).sent).toBe(0);
  });

  it("purges expired demo circles", async () => {
    await repo.createCircle({
      circle: makeCircle({ code: "DEMOXXXX", isDemo: true, expiresAt: at(-60).toISOString() }),
      members: [],
    });
    expect((await runTick(deps(at(-5)))).purgedDemos).toBe(1);
    expect(await repo.getCircle("DEMOXXXX")).toBeNull();
  });

  it("ignores a circle that disappeared between listing and processing", async () => {
    expect(await processCircle(deps(at(0)), "MISSING1")).toEqual({ sent: 0, failed: 0, capped: 0 });
  });
});

describe("reserveMail", () => {
  it("grants up to the cap and resets on a new day in the circle's zone", async () => {
    expect(await reserveMail(repo, CODE, 3, at(0), 4)).toBe(3);
    expect(await reserveMail(repo, CODE, 3, at(0), 4)).toBe(1);
    expect(await reserveMail(repo, CODE, 1, at(0), 4)).toBe(0);
    expect(await reserveMail(repo, CODE, 2, at(24 * 60), 4)).toBe(2);
    expect(await reserveMail(repo, CODE, 0, at(0), 4)).toBe(0);
  });
});

describe("syncMailFlag", () => {
  it("turns the flag on and off with members' emails", async () => {
    await repo.updateCircle(CODE, { mailEnabled: false });
    await syncMailFlag({ repo, circle: makeCircle({ code: CODE, mailEnabled: false }) });
    expect((await repo.getCircle(CODE))?.mailEnabled).toBe(true);
    for (const m of await repo.listMembers(CODE)) await repo.putMember(CODE, { ...m, email: null });
    await syncMailFlag({ repo, circle: makeCircle({ code: CODE, mailEnabled: true }) });
    expect((await repo.getCircle(CODE))?.mailEnabled).toBe(false);
  });
});

describe("mapLimit", () => {
  it("keeps order and never exceeds the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
    expect(await mapLimit([], 3, async (n: number) => n)).toEqual([]);
  });
});
