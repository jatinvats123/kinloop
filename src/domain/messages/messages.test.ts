import { describe, expect, it } from "vitest";
import { t } from "./index";

describe("t", () => {
  it("fills placeholders", () => {
    expect(t("greeting.morning", { name: "Kamla ji" })).toBe("Good morning, Kamla ji");
  });

  it("fills numeric placeholders", () => {
    expect(t("today.progress", { taken: 3, total: 4 })).toBe("3 of 4 taken today");
  });

  it("leaves a missing placeholder visible", () => {
    expect(t("slot.takenAt")).toBe("Taken {time}");
  });

  it("never says a medicine is safe", () => {
    expect(t("check.disclaimer")).toContain("not medical advice");
    expect(t("check.dueNow", { time: "8:00 AM", item: "Metformin 500 mg" })).not.toMatch(/safe/i);
  });
});
