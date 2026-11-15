// Accessibility assertion: runs axe-core against a rendered element and fails on any violation.
import axe from "axe-core";
import { expect } from "vitest";

/** Asserts zero axe violations (colour contrast is verified separately by the token contrast test). */
export async function expectNoAxeViolations(element: Element): Promise<void> {
  const results = await axe.run(element, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
  );
  expect(summary, "axe violations").toEqual([]);
}
