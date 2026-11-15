// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import { makeMember } from "@/test/fixtures";
import { tourSteps, type TourStepId } from "@/domain/tour";
import { TourPanel } from "./tour-panel";

const kamla = makeMember({ id: "k" });
const priya = makeMember({ id: "p", name: "Priya Sharma", role: "family" });
const ramesh = makeMember({ id: "r", name: "Ramesh", role: "caretaker", access: "view" });
const steps = tourSteps("/appointments/a1/brief");
const none = Object.fromEntries(steps.map((s) => [s.id, false])) as Record<TourStepId, boolean>;

function renderPanel(done: Record<TourStepId, boolean>, current = kamla) {
  return render(
    <main>
      <TourPanel
        steps={steps}
        done={done}
        current={current}
        members={[kamla, priya, ramesh]}
        switchAction={vi.fn()}
        hideAction={vi.fn()}
      />
    </main>,
  );
}

describe("TourPanel", () => {
  it("leads with the next step and a deep link, with progress in text", async () => {
    const { container } = renderPanel({ ...none, take: true, check: true });
    expect(screen.getByText("2 of 7 done")).toBeInTheDocument();
    expect(screen.getByText("Next, step 3")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Go as Priya: Change a medicine/ })).toHaveLength(
      2,
    );
    expect(screen.getByRole("button", { name: "Hide tour" })).toBeInTheDocument();
    expect(screen.getByText(/Ramesh \(caretaker, view only\)/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("links directly when the step is already for the current person, and marks done steps", () => {
    renderPanel({ ...none, take: true }, kamla);
    const link = screen.getAllByRole("link", { name: /Go to: Check a sample label/ })[0];
    expect(link).toHaveAttribute("href", "/check");
    expect(screen.getByText("(done)", { exact: false })).toBeInTheDocument();
  });

  it("says so when every step is done", () => {
    const all = Object.fromEntries(steps.map((s) => [s.id, true])) as Record<TourStepId, boolean>;
    renderPanel(all);
    expect(screen.getByText("You have seen every part of Kinloop.")).toBeInTheDocument();
  });
});
