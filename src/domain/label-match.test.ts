import { describe, expect, it } from "vitest";
import { makeItem, makeLog } from "@/test/fixtures";
import {
  ingredientsOf,
  matchLabel,
  normaliseName,
  parseStrengths,
  type LabelReading,
} from "./label-match";

const IST = "Asia/Kolkata";
// 15 Nov 2026: 08:00 IST = 02:30 UTC, 20:00 IST = 14:30 UTC.
const AM8 = "2026-11-15T02:30:00.000Z";
const PM8 = "2026-11-15T14:30:00.000Z";
const at = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60_000);

const metformin = makeItem({
  id: "met",
  name: "Metformin",
  composition: "Metformin hydrochloride",
  dose: "500 mg",
  times: ["08:00", "20:00"],
});
const thyronorm = makeItem({
  id: "thy",
  name: "Thyronorm",
  composition: "Levothyroxine sodium",
  dose: "50 mcg",
  times: ["06:30"],
});
const items = [metformin, thyronorm];

function reading(over: Partial<LabelReading> = {}): LabelReading {
  return {
    readable: true,
    brand: "Glycomet",
    composition: [{ ingredient: "Metformin Hydrochloride IP", strength: "500 mg" }],
    confidence: 0.9,
    ...over,
  };
}

describe("normaliseName", () => {
  it("drops case, punctuation, numbers, salt forms and filler words", () => {
    expect(normaliseName("Metformin Hydrochloride Tablets I.P. 500 mg")).toBe("metformin");
    expect(normaliseName("AMLODIPINE BESYLATE TABS")).toBe("amlodipine");
    expect(normaliseName("Levothyroxine Sodium Tablets USP")).toBe("levothyroxine");
    expect(normaliseName("Glycomet-SR 500")).toBe("glycomet");
    expect(normaliseName("Amlodipine Besylate IP eq. to Amlodipine")).toBe("amlodipine");
    expect(normaliseName("Amlodipine besilate equivalent to amlodipine 5 mg")).toBe("amlodipine");
  });

  it("splits combination compositions into ingredients", () => {
    expect(ingredientsOf("Glimepiride + Metformin HCl")).toEqual(["glimepiride", "metformin"]);
    expect(ingredientsOf("A and B / C")).toEqual(["a", "b", "c"]);
    expect(ingredientsOf(null)).toEqual([]);
  });
});

describe("parseStrengths", () => {
  it("normalises grams and micrograms to milligrams", () => {
    expect(parseStrengths("0.5 g")).toEqual([{ value: 500, unit: "mg" }]);
    expect(parseStrengths("50mcg")).toEqual([{ value: 0.05, unit: "mg" }]);
    expect(parseStrengths("500 mg + 2 mg")).toEqual([
      { value: 500, unit: "mg" },
      { value: 2, unit: "mg" },
    ]);
    expect(parseStrengths("60000 IU")).toEqual([{ value: 60000, unit: "iu" }]);
    expect(parseStrengths("one tablet")).toEqual([]);
    expect(parseStrengths(null)).toEqual([]);
  });
});

describe("matchLabel", () => {
  it("says due now for a brand-name strip that matches the generic on the list", () => {
    const m = matchLabel(reading(), items, [], at(AM8, -5), IST);
    expect(m).toMatchObject({ verdict: "due-now", slotAt: AM8, labelStrength: "500 mg" });
    expect(m.item?.id).toBe("met");
  });

  it("matches a brand printed on the label against the item's own name", () => {
    const m = matchLabel(
      reading({
        brand: "Thyronorm 50",
        composition: [{ ingredient: "Thyroxine", strength: null }],
      }),
      items,
      [],
      at("2026-11-15T01:00:00.000Z", 0),
      IST,
    );
    expect(m).toMatchObject({ verdict: "due-now", item: { id: "thy" } });
  });

  it("opens the due window 60 minutes before and keeps it 120 minutes after the slot", () => {
    expect(matchLabel(reading(), items, [], at(AM8, -61), IST).verdict).toBe("not-now");
    expect(matchLabel(reading(), items, [], at(AM8, -60), IST).verdict).toBe("due-now");
    expect(matchLabel(reading(), items, [], at(AM8, 120), IST).verdict).toBe("due-now");
    expect(matchLabel(reading(), items, [], at(AM8, 121), IST)).toMatchObject({
      verdict: "not-now",
      slotAt: PM8,
    });
  });

  it("says already taken, with the time, to prevent a double dose", () => {
    const logs = [makeLog({ itemId: "met", scheduledAt: AM8, loggedAt: at(AM8, 5).toISOString() })];
    const m = matchLabel(reading(), items, logs, at(AM8, 30), IST);
    expect(m).toMatchObject({ verdict: "already-taken", slotAt: AM8 });
    expect(m.takenAt).toBe(at(AM8, 5).toISOString());
    expect(matchLabel(reading(), items, logs, at(AM8, 180), IST).verdict).toBe("already-taken");
  });

  it("does not treat yesterday's evening dose as taken this morning", () => {
    const night = makeItem({
      id: "ator",
      name: "Atorvastatin",
      composition: null,
      dose: "10 mg",
      times: ["21:00"],
    });
    const yesterday = "2026-11-14T15:30:00.000Z";
    const logs = [makeLog({ itemId: "ator", scheduledAt: yesterday })];
    const m = matchLabel(
      reading({
        brand: "Atorva",
        composition: [{ ingredient: "Atorvastatin calcium", strength: "10 mg" }],
      }),
      [night],
      logs,
      at(AM8, 0),
      IST,
    );
    expect(m).toMatchObject({ verdict: "not-now", slotAt: "2026-11-15T15:30:00.000Z" });
  });

  it("flags a different strength before anything else", () => {
    const m = matchLabel(
      reading({ composition: [{ ingredient: "Metformin", strength: "1000 mg" }] }),
      items,
      [],
      at(AM8, 0),
      IST,
    );
    expect(m).toMatchObject({
      verdict: "strength-mismatch",
      labelStrength: "1000 mg",
      listStrength: "500 mg",
    });
  });

  it("treats equal strengths in different units as the same", () => {
    const m = matchLabel(
      reading({ composition: [{ ingredient: "Metformin", strength: "0.5 g" }] }),
      items,
      [],
      at(AM8, 0),
      IST,
    );
    expect(m.verdict).toBe("due-now");
  });

  it("compares strengths only when both are known", () => {
    const noDose = makeItem({ ...metformin, dose: null });
    expect(matchLabel(reading(), [noDose], [], at(AM8, 0), IST).verdict).toBe("due-now");
    const noLabel = reading({ composition: [{ ingredient: "Metformin", strength: null }] });
    expect(matchLabel(noLabel, items, [], at(AM8, 0), IST).verdict).toBe("due-now");
  });

  it("says not on the list for an unknown medicine, a routine or a paused item", () => {
    const unknown = reading({
      brand: "Crocin",
      composition: [{ ingredient: "Paracetamol", strength: "500 mg" }],
    });
    expect(matchLabel(unknown, items, [], at(AM8, 0), IST).verdict).toBe("not-on-list");
    const paused = [makeItem({ ...metformin, active: false })];
    expect(matchLabel(reading(), paused, [], at(AM8, 0), IST).verdict).toBe("not-on-list");
    const routine = [makeItem({ ...metformin, kind: "routine" })];
    expect(matchLabel(reading(), routine, [], at(AM8, 0), IST).verdict).toBe("not-on-list");
  });

  it("picks the item whose full composition matches when two items share an ingredient", () => {
    const combo = makeItem({
      id: "combo",
      name: "Glycomet GP",
      composition: "Glimepiride + Metformin",
      dose: "1 mg + 500 mg",
      times: ["08:00"],
    });
    const plain = matchLabel(reading({ brand: null }), [combo, metformin], [], at(AM8, 0), IST);
    expect(plain.item?.id).toBe("met");
    const both = reading({
      brand: "Glycomet GP 1",
      composition: [
        { ingredient: "Glimepiride", strength: "1 mg" },
        { ingredient: "Metformin hydrochloride", strength: "500 mg" },
      ],
    });
    const m = matchLabel(both, [metformin, combo], [], at(AM8, 0), IST);
    expect(m).toMatchObject({ verdict: "due-now", item: { id: "combo" } });
  });

  it("prefers the due item when two items match equally", () => {
    const evening = makeItem({ ...metformin, id: "met-pm", times: ["20:00"] });
    const morning = makeItem({ ...metformin, id: "met-am", times: ["08:00"] });
    const m = matchLabel(reading(), [evening, morning], [], at(AM8, 0), IST);
    expect(m).toMatchObject({ verdict: "due-now", item: { id: "met-am" } });
  });

  it("says unreadable when the model could not read it, read no names or is unsure", () => {
    expect(matchLabel(reading({ readable: false }), items, [], at(AM8, 0), IST).verdict).toBe(
      "unreadable",
    );
    expect(
      matchLabel(reading({ brand: " ", composition: [] }), items, [], at(AM8, 0), IST).verdict,
    ).toBe("unreadable");
    expect(matchLabel(reading({ confidence: 0.2 }), items, [], at(AM8, 0), IST).verdict).toBe(
      "unreadable",
    );
  });

  it("finds the next slot across midnight", () => {
    // 23:00 IST on the 15th, the next Thyronorm is 06:30 on the 16th.
    const m = matchLabel(
      reading({ brand: "Thyronorm", composition: [] }),
      items,
      [],
      new Date("2026-11-15T17:30:00.000Z"),
      IST,
    );
    expect(m).toMatchObject({ verdict: "not-now", slotAt: "2026-11-16T01:00:00.000Z" });
  });

  it("treats a skipped slot in the window as not open", () => {
    const logs = [makeLog({ itemId: "met", scheduledAt: AM8, status: "skipped", reason: "other" })];
    expect(matchLabel(reading(), items, logs, at(AM8, 10), IST)).toMatchObject({
      verdict: "not-now",
      slotAt: PM8,
    });
  });
});
