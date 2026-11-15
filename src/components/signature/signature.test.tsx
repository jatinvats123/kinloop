// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import { DayBloom } from "./day-bloom";
import { DotRow, ThinCurve, TickBar } from "./data-marks";
import { SlotCard } from "./slot-card";
import { AiLabel, Sparkle } from "./sparkle";
import { StatusLabel } from "./status-label";
import { VerdictPanel } from "./verdict-panel";
import { WeekStrip } from "./week-strip";

describe("DayBloom", () => {
  it("draws one petal per slot and hides itself from assistive tech", () => {
    const { container } = render(<DayBloom total={4} done={1} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("path")).toHaveLength(4);
  });

  it("fills exactly the done petals", () => {
    const { container } = render(<DayBloom total={5} done={3} />);
    const filled = [...container.querySelectorAll("path")].filter((p) =>
      p.getAttribute("fill")?.startsWith("url("),
    );
    expect(filled).toHaveLength(3);
  });

  it("shows a bud when nothing is scheduled and a ring when the day is whole", () => {
    const { container: empty } = render(<DayBloom total={0} done={0} />);
    expect(empty.querySelectorAll("path")).toHaveLength(0);
    const { container: whole } = render(
      <DayBloom total={2} done={2} size="sm" tone="dark" breathing />,
    );
    expect(whole.querySelector("circle[stroke-dasharray]")).not.toBeNull();
  });
});

describe("SlotCard", () => {
  const items = [
    {
      id: "a",
      kind: "medicine" as const,
      name: "Metformin 500 mg",
      detail: "After breakfast",
      status: "due" as const,
    },
    {
      id: "b",
      kind: "routine" as const,
      name: "Evening walk",
      detail: "20 minutes",
      status: "taken" as const,
    },
  ];

  it("renders the due state with its action and accessible status text", async () => {
    const { container } = render(
      <ol>
        <SlotCard
          time="8:00"
          meridiem="AM"
          status="due"
          statusText="Due now"
          items={items}
          action={<button type="button">I&apos;ve taken these</button>}
          itemAction={(i) => <button type="button">Skip {i.name}</button>}
        />
      </ol>,
    );
    expect(screen.getByText("Due now")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip Metformin 500 mg" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip Evening walk" })).toBeNull();
    expect(screen.getByText("(taken)")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("collapses a settled slot into a quiet row", () => {
    render(
      <ol>
        <SlotCard
          time="8:00"
          meridiem="AM"
          status="taken"
          statusText="Taken"
          settledText="Taken 8:05 AM"
          items={items}
        />
      </ol>,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("8:00 AM, Taken 8:05 AM");
  });
});

describe("other signature components", () => {
  it("week strip announces each day's progress", async () => {
    const { container } = render(
      <WeekStrip
        days={[
          { date: "2026-11-13", weekday: "Fr", day: 13, total: 4, done: 4, isToday: false },
          { date: "2026-11-14", weekday: "Sa", day: 14, total: 0, done: 0, isToday: true },
        ]}
      />,
    );
    expect(screen.getByText("4 of 4 done")).toBeInTheDocument();
    expect(screen.getByText("nothing scheduled, today")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("data marks carry text equivalents", () => {
    render(
      <>
        <TickBar marks={["taken", "missed", "skipped", "none"]} label="1 of 3 taken" tone="dark" />
        <DotRow marks={["taken", "missed", "skipped"]} label="Evening 1 of 3" />
        <ThinCurve values={[50, 120, -5]} label="Trend" tone="dark" />
        <ThinCurve values={[70]} label="Single" />
      </>,
    );
    expect(screen.getByText("1 of 3 taken")).toBeInTheDocument();
    expect(screen.getByText("Evening 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Single")).toBeInTheDocument();
  });

  it("verdict panel is a live status region", async () => {
    const { container } = render(
      <VerdictPanel
        tone="stop"
        sentence="Not on your list."
        detail="Ask Priya"
        action={<button type="button">OK</button>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Not on your list.");
    await expectNoAxeViolations(container);
    render(<VerdictPanel tone="neutral" sentence="Couldn't read it." />);
    render(<VerdictPanel tone="match" sentence="Yes." />);
  });

  it("status labels pair an icon with text for every status", () => {
    for (const s of ["taken", "skipped", "missed", "due", "upcoming"] as const)
      render(<StatusLabel status={s} />);
    expect(screen.getByText("Not yet")).toBeInTheDocument();
    expect(screen.getByText("Missed")).toBeInTheDocument();
  });

  it("AI label shows the sparkle with visible text", () => {
    const { container } = render(
      <>
        <AiLabel />
        <Sparkle />
      </>,
    );
    expect(screen.getByText("AI-drafted")).toBeInTheDocument();
    expect(container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(2);
  });
});
