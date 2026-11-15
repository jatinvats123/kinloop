import { describe, expect, it } from "vitest";
import { makeCircle, makeItem, makeLog } from "@/test/fixtures";
import type { Appointment } from "@/domain/types";
import { BRIEF_ROW_LIMIT, briefFactsText, buildVisitBriefFacts } from "./visit-brief";

// 15 Nov 2026, 12:00 IST.
const NOW = new Date("2026-11-15T06:30:00.000Z");
const appt: Appointment = {
  id: "a1",
  doctor: "Dr. Mehta",
  specialty: "Cardiology",
  location: "City Clinic",
  at: "2026-11-16T05:00:00.000Z",
  notes: "",
};
const circle = makeCircle({
  profile: {
    conditions: ["Type 2 diabetes"],
    allergies: ["Penicillin"],
    bloodGroup: "B+",
    primaryDoctor: "Dr. Rao",
    emergencyContact: { name: "Priya", phone: "+91 90000 00000" },
  },
});
/** 08:00 IST on 2026-11-DD as a UTC instant. */
const am8 = (dd: number) => `2026-11-${String(dd).padStart(2, "0")}T02:30:00.000Z`;
/** 20:00 IST on 2026-11-DD as a UTC instant. */
const pm8 = (dd: number) => `2026-11-${String(dd).padStart(2, "0")}T14:30:00.000Z`;

describe("buildVisitBriefFacts", () => {
  const met = makeItem({ id: "met", times: ["08:00", "20:00"], startDate: "2026-11-10" });
  const bp = makeItem({
    id: "bp",
    kind: "routine",
    name: "Check blood pressure",
    composition: null,
    dose: null,
    times: ["09:00"],
    startDate: "2026-11-14",
    active: false,
  });
  const logs = [
    ...[10, 11, 12, 13, 14, 15].map((d) => makeLog({ itemId: "met", scheduledAt: am8(d) })),
    makeLog({ itemId: "met", scheduledAt: pm8(12), status: "skipped", reason: "felt-unwell" }),
    makeLog({ itemId: "met", scheduledAt: pm8(13), status: "skipped", reason: null }),
    makeLog({ itemId: "bp", scheduledAt: "2026-11-14T03:30:00.000Z", note: "142/90" }),
  ];
  const facts = buildVisitBriefFacts({
    circle,
    appointment: appt,
    items: [met, bp],
    logs,
    now: NOW,
  });

  it("computes adherence, missed doses and the most-missed part of the day from the logs", () => {
    // Metformin: 6 mornings taken, evenings 10,11,14 missed, 12,13 skipped; BP is paused, so it is not counted.
    expect(facts.adherence).toMatchObject({ taken: 6, skipped: 2, missed: 3, days: 30 });
    expect(facts.adherence.percent30).toBe(55);
    expect(facts.adherence.mostMissedPart).toBe("evening");
    expect(facts.missed.map((m) => m.date)).toEqual(["14 Nov", "11 Nov", "10 Nov"]);
    expect(facts.missed[0]).toMatchObject({ time: "8:00 PM", item: "Metformin 500 mg" });
  });

  it("lists skips most recent first with their reasons, and readings noted when logging", () => {
    expect(facts.skips).toEqual([
      { date: "13 Nov", time: "8:00 PM", item: "Metformin 500 mg", reason: "No reason given" },
      { date: "12 Nov", time: "8:00 PM", item: "Metformin 500 mg", reason: "Felt unwell" },
    ]);
    expect(facts.readings).toEqual([
      { date: "14 Nov", item: "Check blood pressure", note: "142/90" },
    ]);
  });

  it("carries the schedule (with paused items marked) and the profile, but no contact details", () => {
    expect(facts.schedule[0]).toMatchObject({ name: "Metformin", times: ["8:00 AM", "8:00 PM"] });
    expect(facts.schedule[1]).toMatchObject({ kind: "routine", paused: true });
    expect(facts.profile).toEqual({
      conditions: ["Type 2 diabetes"],
      allergies: ["Penicillin"],
      bloodGroup: "B+",
      primaryDoctor: "Dr. Rao",
    });
    expect(JSON.stringify(facts)).not.toContain("90000");
  });

  it("caps listed rows and names logs whose item was removed", () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      makeLog({ itemId: "gone", scheduledAt: am8(i + 1), status: "skipped", reason: "ran-out" }),
    );
    const f = buildVisitBriefFacts({ circle, appointment: appt, items: [], logs: many, now: NOW });
    expect(f.skips).toHaveLength(BRIEF_ROW_LIMIT);
    expect(f.skips[0]).toMatchObject({ item: "A removed item", reason: "Ran out" });
    expect(f.adherence.percent30).toBeNull();
  });
});

describe("briefFactsText", () => {
  it("renders the clinical facts for the AI without the doctor's or family's names", () => {
    const f = buildVisitBriefFacts({
      circle,
      appointment: appt,
      items: [makeItem({ startDate: "2026-11-15" })],
      logs: [],
      now: NOW,
    });
    const text = briefFactsText(f);
    expect(text).toContain("Cardiology appointment");
    expect(text).toContain("Allergies: Penicillin");
    expect(text).toContain("- medicine Metformin 500 mg at 8:00 AM; After breakfast");
    expect(text).toContain("Skipped doses (most recent first):\n- none");
    expect(text).not.toMatch(/Mehta|Priya|Kamla/);
  });

  it("says when there is not enough data and when nothing is recorded", () => {
    const empty = makeCircle();
    const f = buildVisitBriefFacts({
      circle: empty,
      appointment: { ...appt, specialty: "" },
      items: [],
      logs: [],
      now: NOW,
    });
    const text = briefFactsText(f);
    expect(text).toContain("Visit: doctor appointment.");
    expect(text).toContain("Conditions: none recorded.");
    expect(text).toContain("not enough data");
  });
});
