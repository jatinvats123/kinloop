import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "./calendar-link";
import {
  CODE_ALPHABET,
  formatCircleCode,
  generateCircleCode,
  generatePasscode,
  isPasscode,
  parseCircleCode,
} from "./codes";
import { reminderLadder } from "./config";

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] as number;
};

describe("circle codes", () => {
  it("generates 8 characters from the unambiguous alphabet", () => {
    const code = generateCircleCode(seq([0, 1, 2, 3, 4, 5, 6, 24]));
    expect(code).toBe("ACDEFGH9");
    expect(CODE_ALPHABET).not.toMatch(/[0O1IL5S2Z8B]/);
  });

  it("formats and parses the XXXX-XXXX display form", () => {
    expect(formatCircleCode("ACDEFGHJ")).toBe("ACDE-FGHJ");
    expect(parseCircleCode(" acde-fghj ")).toBe("ACDEFGHJ");
  });

  it("rejects malformed codes", () => {
    expect(parseCircleCode("ACDE-FGH")).toBeNull();
    expect(parseCircleCode("ACDE-FGH0")).toBeNull();
  });
});

describe("passcodes", () => {
  it("generates six digits, keeping leading zeros", () => {
    expect(generatePasscode(seq([0, 0, 4, 2, 7, 9]))).toBe("004279");
  });

  it("validates six digits only", () => {
    expect(isPasscode("004279")).toBe(true);
    expect(isPasscode("12345")).toBe(false);
    expect(isPasscode("12345a")).toBe(false);
  });
});

describe("googleCalendarUrl", () => {
  it("builds a one-hour event template with title, place and notes", () => {
    const url = new URL(
      googleCalendarUrl(
        {
          id: "a",
          doctor: "Dr. Mehra",
          specialty: "Cardiology",
          location: "Apollo, Delhi",
          at: "2026-11-15T05:30:00.000Z",
          notes: "Bring reports",
        },
        "Kamla Devi",
      ),
    );
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("text")).toBe("Kamla Devi: Dr. Mehra (Cardiology)");
    expect(url.searchParams.get("dates")).toBe("20261115T053000Z/20261115T063000Z");
    expect(url.searchParams.get("details")).toContain("Bring reports");
  });

  it("omits an empty specialty and notes", () => {
    const url = new URL(
      googleCalendarUrl(
        {
          id: "a",
          doctor: "Dr. Rao",
          specialty: "",
          location: "",
          at: "2026-11-15T05:30:00.000Z",
          notes: "",
        },
        "Kamla",
      ),
    );
    expect(url.searchParams.get("text")).toBe("Kamla: Dr. Rao");
    expect(url.searchParams.get("details")).toBe("Added from Kinloop.");
  });
});

describe("reminder ladder", () => {
  it("tells the elder first and the circle last", () => {
    expect(reminderLadder.dueOffsetMin).toBeLessThan(reminderLadder.missedElderOffsetMin);
    expect(reminderLadder.missedElderOffsetMin).toBeLessThan(reminderLadder.missedCircleOffsetMin);
  });
});
