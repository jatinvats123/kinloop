import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors, contrastRatio, textPairs } from "./tokens";

describe("colour contrast", () => {
  it.each(textPairs)("$fg on $bg meets $min:1 ($where)", ({ fg, bg, min }) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });

  it("computes the textbook black-on-white ratio", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("keeps the TypeScript tokens in sync with the CSS theme", () => {
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    for (const hex of Object.values(colors)) {
      expect(css).toContain(hex.toLowerCase());
    }
  });
});
