import { describe, expect, it } from "vitest";
import type { ActivityEntry } from "./types";
import { tourProgress, tourSteps } from "./tour";

const SINCE = "2026-11-15T06:00:00.000Z";
const members = [
  { id: "k", role: "elder" as const },
  { id: "p", role: "family" as const },
  { id: "r", role: "caretaker" as const },
];
const entry = (
  action: string,
  actorId: string,
  at = "2026-11-15T06:05:00.000Z",
): ActivityEntry => ({
  id: `${action}-${actorId}-${at}`,
  actorId,
  actor: actorId,
  action,
  summary: "",
  at,
});

describe("tourSteps", () => {
  it("lists the seven steps in the order a visitor should try them, with deep links", () => {
    const steps = tourSteps("/appointments/a1/brief");
    expect(steps.map((s) => s.id)).toEqual([
      "take",
      "check",
      "change",
      "approve",
      "test-email",
      "import",
      "brief",
    ]);
    expect(steps.find((s) => s.id === "change")?.as).toBe("family");
    expect(steps.at(-1)?.href).toBe("/appointments/a1/brief");
  });
});

describe("tourProgress", () => {
  it("ticks nothing for a fresh demo, even with seeded history before it was created", () => {
    const seeded = [
      entry("proposal.created", "p", "2026-11-15T05:15:00.000Z"),
      entry("dose.taken", "k", "2026-11-14T03:00:00.000Z"),
    ];
    expect(Object.values(tourProgress(seeded, members, SINCE)).some(Boolean)).toBe(false);
  });

  it("ticks each step from the matching activity by the right person", () => {
    const done = tourProgress(
      [
        entry("dose.taken", "k"),
        entry("label.checked", "p"),
        entry("proposal.created", "p"),
        entry("proposal.approved", "k"),
        entry("reminder.test", "r"),
        entry("prescription.read", "p"),
        entry("brief.opened", "r"),
      ],
      members,
      SINCE,
    );
    expect(Object.values(done).every(Boolean)).toBe(true);
  });

  it("does not tick a step done by the wrong person", () => {
    const done = tourProgress(
      [entry("dose.taken", "p"), entry("item.updated", "k"), entry("proposal.approved", "unknown")],
      members,
      SINCE,
    );
    expect(done).toMatchObject({ take: false, change: false, approve: false });
  });

  it("counts a direct medicine edit by the family member as the change step", () => {
    expect(tourProgress([entry("item.updated", "p")], members, SINCE).change).toBe(true);
  });
});
