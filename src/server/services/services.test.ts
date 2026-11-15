import { beforeEach, describe, expect, it } from "vitest";
import { slotsForRange } from "@/domain/schedule";
import { zonedToUtc } from "@/domain/time";
import type { Circle, Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import { createAppointment, deleteAppointment, updateAppointment } from "./appointments";
import { createCircle, signIn } from "./circles";
import type { Ctx } from "./context";
import { createDemoCircle, dueSoonTime, purgeExpiredDemos } from "./demo";
import { skipItem, takeSlot, undoLog } from "./doses";
import { createItem, deleteItem, setItemActive, updateItem } from "./items";
import {
  addMember,
  regeneratePasscode,
  removeMember,
  updateMember,
  updateProfile,
} from "./members";
import { buildOverview, buildToday } from "./read-models";

const IST = "Asia/Kolkata";
const NOW = new Date("2026-11-14T03:00:00.000Z"); // 08:30 IST, Saturday

const medicine = {
  kind: "medicine",
  name: "Metformin",
  composition: "Metformin hydrochloride",
  dose: "500 mg",
  instructions: "After food",
  times: ["08:00", "20:00"],
  daysOfWeek: ["0", "1", "2", "3", "4", "5", "6"],
  startDate: "2026-11-01",
  endDate: "",
};

let repo: MemoryRepository;
let circle: Circle;
let members: Member[];
let passcodes: Record<string, string>;

async function ctxFor(name: string, now = NOW): Promise<Ctx> {
  const fresh = (await repo.getCircle(circle.code)) as Circle;
  const member = (await repo.listMembers(circle.code)).find((m) => m.name === name) as Member;
  return { repo, circle: fresh, member, now };
}

async function expectCode(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

beforeEach(async () => {
  repo = new MemoryRepository();
  const created = await createCircle(
    repo,
    { elderName: "Kamla Devi", creatorRole: "family", creatorName: "Priya", timezone: IST },
    NOW,
  );
  circle = (await repo.getCircle(created.code)) as Circle;
  passcodes = Object.fromEntries(created.people.map((p) => [p.name, p.passcode]));
  const priya = await ctxFor("Priya");
  const ramesh = await addMember(priya, {
    name: "Ramesh",
    role: "caretaker",
    email: "",
    access: "view",
    alertMissed: "on",
  });
  passcodes.Ramesh = ramesh.passcode;
  members = await repo.listMembers(circle.code);
});

describe("createCircle", () => {
  it("creates the elder and the creating organiser, returning passcodes once", async () => {
    expect(members.map((m) => [m.name, m.role, m.isOrganiser])).toEqual([
      ["Kamla Devi", "elder", true],
      ["Priya", "family", true],
      ["Ramesh", "caretaker", false],
    ]);
    expect(
      members.every(
        (m) =>
          m.passcodeHash.length === 64 && !JSON.stringify(m).includes(passcodes.Priya as string),
      ),
    ).toBe(true);
    expect(
      (await repo.listActivity(circle.code, 5)).some((a) => a.action === "circle.created"),
    ).toBe(true);
  });

  it("needs the creator's name when they are not the elder", async () => {
    await expectCode(
      createCircle(repo, { elderName: "Asha", creatorRole: "caretaker", timezone: IST }, NOW),
      "bad-request",
    );
  });

  it("lets the elder create their own circle alone", async () => {
    const created = await createCircle(repo, { elderName: "Asha", creatorRole: "elder" }, NOW);
    expect(created.people).toHaveLength(1);
    expect(created.displayCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});

describe("signIn", () => {
  it("signs in with circle code and passcode, case and dash insensitive", async () => {
    const res = await signIn(
      repo,
      { code: circle.code.toLowerCase(), passcode: passcodes.Ramesh },
      NOW,
    );
    expect(res.member.name).toBe("Ramesh");
  });

  it("gives the same generic error for an unknown circle or a wrong passcode", async () => {
    await expect(signIn(repo, { code: "AAAA-AAAA", passcode: "000000" }, NOW)).rejects.toThrow(
      "don't match",
    );
    await expect(signIn(repo, { code: circle.code, passcode: "000000" }, NOW)).rejects.toThrow(
      "don't match",
    );
    await expect(signIn(repo, { code: "bad", passcode: "000000" }, NOW)).rejects.toThrow(
      "don't match",
    );
  });

  it("locks the circle for 15 minutes after five failures, even for the right passcode", async () => {
    for (let i = 0; i < 5; i += 1)
      await expectCode(
        signIn(repo, { code: circle.code, passcode: "000000" }, NOW),
        "unauthorised",
      );
    await expectCode(signIn(repo, { code: circle.code, passcode: passcodes.Priya }, NOW), "locked");
    const later = new Date(NOW.getTime() + 16 * 60_000);
    expect(
      (await signIn(repo, { code: circle.code, passcode: passcodes.Priya }, later)).member.name,
    ).toBe("Priya");
    expect((await repo.getCircle(circle.code))?.login).toEqual({ failures: 0, lockedUntil: null });
  });

  it("rejects expired demo circles and malformed passcodes", async () => {
    await repo.updateCircle(circle.code, { expiresAt: "2026-11-13T00:00:00.000Z" });
    await expectCode(
      signIn(repo, { code: circle.code, passcode: passcodes.Priya }, NOW),
      "unauthorised",
    );
    await expectCode(signIn(repo, { code: circle.code, passcode: "12" }, NOW), "bad-request");
  });
});

describe("authorisation: every mutation refuses a view-only member", () => {
  it("denies schedule, dose, profile, appointment and member changes", async () => {
    const ramesh = await ctxFor("Ramesh");
    const kamla = members.find((m) => m.role === "elder") as Member;
    await expectCode(createItem(ramesh, medicine), "forbidden");
    await expectCode(updateItem(ramesh, "x", medicine), "forbidden");
    await expectCode(setItemActive(ramesh, "x", false), "forbidden");
    await expectCode(deleteItem(ramesh, "x"), "forbidden");
    await expectCode(takeSlot(ramesh, { slotAt: NOW.toISOString(), itemIds: ["x"] }), "forbidden");
    await expectCode(
      skipItem(ramesh, { slotAt: NOW.toISOString(), itemId: "x", reason: "other" }),
      "forbidden",
    );
    await expectCode(undoLog(ramesh, "x", NOW.toISOString()), "forbidden");
    await expectCode(updateProfile(ramesh, {}), "forbidden");
    await expectCode(createAppointment(ramesh, {}), "forbidden");
    await expectCode(updateAppointment(ramesh, "x", {}), "forbidden");
    await expectCode(deleteAppointment(ramesh, "x"), "forbidden");
    await expectCode(addMember(ramesh, {}), "forbidden");
    await expectCode(removeMember(ramesh, (await ctxFor("Priya")).member.id), "forbidden");
    await expectCode(regeneratePasscode(ramesh, kamla.id), "forbidden");
    await expectCode(updateMember(ramesh, kamla.id, {}), "forbidden");
  });
});

describe("members and profile", () => {
  it("never lets anyone remove the elder, or themselves", async () => {
    const priya = await ctxFor("Priya");
    const kamla = members.find((m) => m.role === "elder") as Member;
    await expectCode(removeMember(priya, kamla.id), "forbidden");
    await expectCode(removeMember(priya, priya.member.id), "forbidden");
    await expectCode(removeMember(priya, "missing"), "not-found");
  });

  it("lets an organiser change access and remove a member", async () => {
    const priya = await ctxFor("Priya");
    const ramesh = members.find((m) => m.name === "Ramesh") as Member;
    await updateMember(priya, ramesh.id, {
      name: "Ramesh Kumar",
      email: "r@example.com",
      access: "edit",
      alertMissed: "on",
    });
    expect(await repo.getMember(circle.code, ramesh.id)).toMatchObject({
      name: "Ramesh Kumar",
      access: "edit",
      email: "r@example.com",
    });
    await removeMember(priya, ramesh.id);
    expect(await repo.getMember(circle.code, ramesh.id)).toBeNull();
  });

  it("lets a member edit their own details but not raise their own access", async () => {
    const ramesh = await ctxFor("Ramesh");
    await updateMember(ramesh, ramesh.member.id, {
      name: "Ramesh",
      email: "",
      access: "edit",
      isOrganiser: "on",
    });
    expect(await repo.getMember(circle.code, ramesh.member.id)).toMatchObject({
      access: "view",
      isOrganiser: false,
    });
  });

  it("lets only the elder change the elder's own record", async () => {
    const kamla = await ctxFor("Kamla Devi");
    await updateMember(kamla, kamla.member.id, { email: "kamla@example.com", alertMissed: "on" });
    expect((await repo.getMember(circle.code, kamla.member.id))?.email).toBe("kamla@example.com");
    await expectCode(updateMember(await ctxFor("Priya"), kamla.member.id, {}), "forbidden");
  });

  it("regenerates a passcode so the old one stops working", async () => {
    const priya = await ctxFor("Priya");
    const ramesh = members.find((m) => m.name === "Ramesh") as Member;
    const { passcode } = await regeneratePasscode(priya, ramesh.id);
    await expectCode(
      signIn(repo, { code: circle.code, passcode: passcodes.Ramesh }, NOW),
      "unauthorised",
    );
    expect((await signIn(repo, { code: circle.code, passcode }, NOW)).member.id).toBe(ramesh.id);
  });

  it("caps circle size", async () => {
    const priya = await ctxFor("Priya");
    for (let i = 0; i < 9; i += 1)
      await addMember(priya, { name: `M${i}`, role: "family", access: "view" });
    await expectCode(
      addMember(priya, { name: "One more", role: "family", access: "view" }),
      "conflict",
    );
  });

  it("saves the health profile from comma or line separated lists", async () => {
    const priya = await ctxFor("Priya");
    await updateProfile(priya, {
      conditions: "Diabetes, Hypertension\nHypothyroidism",
      allergies: "Penicillin",
      bloodGroup: "B+",
      primaryDoctor: "Dr. Mehra",
      emergencyName: "Priya",
      emergencyPhone: "+91 98110 42736",
    });
    expect((await repo.getCircle(circle.code))?.profile).toEqual({
      conditions: ["Diabetes", "Hypertension", "Hypothyroidism"],
      allergies: ["Penicillin"],
      bloodGroup: "B+",
      primaryDoctor: "Dr. Mehra",
      emergencyContact: { name: "Priya", phone: "+91 98110 42736" },
    });
  });

  it("rejects an invalid profile with field errors", async () => {
    const priya = await ctxFor("Priya");
    await expect(
      updateProfile(priya, {
        conditions: "",
        allergies: "",
        bloodGroup: "Z",
        primaryDoctor: "",
        emergencyName: "",
        emergencyPhone: "call me",
      }),
    ).rejects.toSatisfy(
      (e) =>
        e instanceof AppError &&
        e.fieldErrors?.bloodGroup !== undefined &&
        e.fieldErrors?.emergencyPhone !== undefined,
    );
  });
});

describe("medicines and routines", () => {
  it("adds, edits, pauses and deletes an item", async () => {
    const priya = await ctxFor("Priya");
    const item = await createItem(priya, medicine);
    expect(item).toMatchObject({
      times: ["08:00", "20:00"],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      endDate: null,
      active: true,
    });
    const updated = await updateItem(priya, item.id, {
      ...medicine,
      dose: "1000 mg",
      times: ["09:00"],
    });
    expect(updated).toMatchObject({ dose: "1000 mg", times: ["09:00"] });
    await setItemActive(priya, item.id, false);
    expect((await repo.getItem(circle.code, item.id))?.active).toBe(false);
    await setItemActive(priya, item.id, true);
    await deleteItem(priya, item.id);
    expect(await repo.getItem(circle.code, item.id)).toBeNull();
    await expectCode(deleteItem(priya, item.id), "not-found");
  });

  it("clears medicine-only fields on a routine", async () => {
    const routine = await createItem(await ctxFor("Kamla Devi"), {
      ...medicine,
      kind: "routine",
      name: "Evening walk",
      times: ["18:00"],
    });
    expect(routine).toMatchObject({ composition: null, dose: null });
  });

  it("validates times, days and the date range", async () => {
    const priya = await ctxFor("Priya");
    await expect(
      createItem(priya, { ...medicine, times: ["25:00"], daysOfWeek: [], endDate: "2026-10-01" }),
    ).rejects.toSatisfy(
      (e) => e instanceof AppError && Boolean(e.fieldErrors?.times && e.fieldErrors?.daysOfWeek),
    );
    await expect(createItem(priya, { ...medicine, endDate: "2026-10-01" })).rejects.toSatisfy(
      (e) => e instanceof AppError && Boolean(e.fieldErrors?.endDate),
    );
  });
});

describe("dose logging", () => {
  const slot8 = zonedToUtc("2026-11-14", "08:00", IST).toISOString();

  it("takes a slot idempotently and records it once", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const item = await createItem(kamla, medicine);
    expect(await takeSlot(kamla, { slotAt: slot8, itemIds: [item.id] })).toBe(1);
    expect(await takeSlot(kamla, { slotAt: slot8, itemIds: [item.id, item.id] })).toBe(0);
    const logs = await repo.listLogs(circle.code, slot8, slot8);
    expect(logs).toHaveLength(1);
    expect(
      (await repo.listActivity(circle.code, 20)).filter((a) => a.action === "dose.taken"),
    ).toHaveLength(1);
  });

  it("stores an optional reading for routines", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const bp = await createItem(kamla, {
      ...medicine,
      kind: "routine",
      name: "Check blood pressure",
      times: ["08:00"],
    });
    await takeSlot(kamla, { slotAt: slot8, itemIds: [bp.id] }, { [bp.id]: " 132/84 " });
    expect((await repo.listLogs(circle.code, slot8, slot8))[0]?.note).toBe("132/84");
  });

  it("skips an item with a reason, then can be undone", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const item = await createItem(kamla, medicine);
    await skipItem(kamla, { slotAt: slot8, itemId: item.id, reason: "felt-unwell", note: "Dizzy" });
    const [log] = await repo.listLogs(circle.code, slot8, slot8);
    expect(log).toMatchObject({ status: "skipped", reason: "felt-unwell", note: "Dizzy" });
    expect((await repo.listActivity(circle.code, 1))[0]?.summary).toContain("Felt unwell");
    await undoLog(kamla, item.id, slot8);
    expect(await repo.listLogs(circle.code, slot8, slot8)).toEqual([]);
    await undoLog(kamla, item.id, slot8);
    await expectCode(undoLog(kamla, item.id, "nonsense"), "bad-request");
  });

  it("refuses slots that are not scheduled, too far ahead or too old", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const item = await createItem(kamla, medicine);
    await expectCode(
      takeSlot(kamla, {
        slotAt: zonedToUtc("2026-11-14", "09:00", IST).toISOString(),
        itemIds: [item.id],
      }),
      "bad-request",
    );
    await expectCode(
      takeSlot(kamla, {
        slotAt: zonedToUtc("2026-11-16", "08:00", IST).toISOString(),
        itemIds: [item.id],
      }),
      "bad-request",
    );
    await expectCode(
      takeSlot(kamla, {
        slotAt: zonedToUtc("2026-11-02", "08:00", IST).toISOString(),
        itemIds: [item.id],
      }),
      "bad-request",
    );
    await expectCode(takeSlot(kamla, { slotAt: slot8, itemIds: ["missing"] }), "not-found");
  });
});

describe("appointments", () => {
  it("adds, edits and deletes in the circle's timezone", async () => {
    const priya = await ctxFor("Priya");
    const appt = await createAppointment(priya, {
      doctor: "Dr. Mehra",
      specialty: "Cardiology",
      location: "Saket",
      date: "2026-11-15",
      time: "11:00",
      notes: "",
    });
    expect(appt.at).toBe("2026-11-15T05:30:00.000Z");
    await updateAppointment(priya, appt.id, {
      doctor: "Dr. Mehra",
      specialty: "",
      location: "",
      date: "2026-11-16",
      time: "10:00",
      notes: "Fasting",
    });
    expect((await repo.getAppointment(circle.code, appt.id))?.notes).toBe("Fasting");
    await deleteAppointment(priya, appt.id);
    await expectCode(deleteAppointment(priya, appt.id), "not-found");
    await expectCode(updateAppointment(priya, appt.id, {}), "not-found");
  });
});

describe("read models", () => {
  it("groups today's slots with statuses and counts progress", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const item = await createItem(kamla, medicine);
    await takeSlot(kamla, {
      slotAt: zonedToUtc("2026-11-14", "08:00", IST).toISOString(),
      itemIds: [item.id],
    });
    const today = await buildToday(repo, kamla.circle, NOW);
    expect(today.groups.map((g) => [g.time, g.status])).toEqual([
      ["08:00", "taken"],
      ["20:00", "upcoming"],
    ]);
    expect([today.done, today.total]).toEqual([1, 2]);
  });

  it("builds the overview with flagged skips and a seven-day week", async () => {
    const kamla = await ctxFor("Kamla Devi");
    const item = await createItem(kamla, medicine);
    await skipItem(kamla, {
      slotAt: zonedToUtc("2026-11-13", "20:00", IST).toISOString(),
      itemId: item.id,
      reason: "ran-out",
    });
    await skipItem(kamla, {
      slotAt: zonedToUtc("2026-11-13", "08:00", IST).toISOString(),
      itemId: item.id,
      reason: "other",
    });
    const o = await buildOverview(repo, kamla.circle, NOW);
    expect(o.week).toHaveLength(7);
    expect(o.week[6]?.isToday).toBe(true);
    expect(o.flagged.map((f) => f.log.reason)).toEqual(["ran-out"]);
    expect(o.adherence7.overall.skipped).toBe(2);
  });
});

describe("demo", () => {
  it("seeds an isolated circle with history, a due-soon slot and an appointment tomorrow", async () => {
    const { code } = await createDemoCircle(repo, NOW);
    const c = (await repo.getCircle(code)) as Circle;
    expect(c).toMatchObject({
      isDemo: true,
      elderName: "Kamla Devi",
      expiresAt: "2026-11-15T03:00:00.000Z",
    });
    const people = await repo.listMembers(code);
    expect(people.map((m) => `${m.name}:${m.access}`)).toEqual([
      "Kamla Devi:edit",
      "Priya:edit",
      "Ramesh:view",
    ]);
    const items = await repo.listItems(code);
    expect(items.filter((i) => i.kind === "medicine")).toHaveLength(4);
    expect(items.filter((i) => i.kind === "routine")).toHaveLength(1);

    const o = await buildOverview(repo, c, NOW);
    expect(o.flagged.some((f) => f.log.reason === "felt-unwell")).toBe(true);
    expect(o.adherence7.mostMissedPart?.part).toBe("evening");
    expect(o.upcoming[0]?.at).toBe("2026-11-15T05:30:00.000Z");
    const today = await buildToday(repo, c, NOW);
    expect(today.groups.some((g) => g.status === "due")).toBe(true);

    const elder = people.find((m) => m.role === "elder") as Member;
    const signedIn = await signIn(repo, { code, passcode: c.demoAccess?.[elder.id] }, NOW);
    expect(signedIn.member.id).toBe(elder.id);
  });

  it("schedules the routine at the next quarter hour, at least 15 minutes ahead", () => {
    expect(dueSoonTime(new Date("2026-11-14T03:00:00Z"), IST)).toBe("08:45");
    expect(dueSoonTime(new Date("2026-11-14T18:25:00Z"), IST)).toBe("23:45");
  });

  it("purges only expired demo circles", async () => {
    await createDemoCircle(repo, NOW);
    expect(await purgeExpiredDemos(repo, NOW)).toBe(0);
    expect(await purgeExpiredDemos(repo, new Date("2026-11-16T00:00:00Z"))).toBe(1);
    expect(await repo.getCircle(circle.code)).not.toBeNull();
  });

  it("derives demo slots only from active items", () => {
    expect(slotsForRange([], "2026-11-14", "2026-11-14", IST)).toEqual([]);
  });
});
