// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import type { BriefDraft as Draft } from "@/domain/types";
import { BriefDraft, PrintButton } from "./brief-draft";

const draft: Draft = {
  appointmentId: "a1",
  factsHash: "h",
  mention: ["Evening doses were missed three times."],
  questions: ["What should we watch for?"],
  at: "2026-11-15T06:30:00.000Z",
};

describe("BriefDraft", () => {
  it("shows a cached draft as plain text, labelled as AI-drafted and not medical advice", async () => {
    const { container } = render(
      <main>
        <BriefDraft appointmentId="a1" initial={draft} action={vi.fn()} />
      </main>,
    );
    expect(screen.getByText("Evening doses were missed three times.")).toBeInTheDocument();
    expect(screen.getByText("AI-drafted from the facts above")).toBeInTheDocument();
    expect(screen.getByText(/not medical advice/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Draft points/ })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("drafts on an explicit press and shows the result, or a calm error", async () => {
    const action = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "The AI helper isn't available right now." })
      .mockResolvedValueOnce({ ok: true, data: { ...draft, mention: [] } });
    const { container } = render(
      <main>
        <BriefDraft appointmentId="a1" initial={null} action={action} />
      </main>,
    );
    await expectNoAxeViolations(container);
    fireEvent.click(screen.getByRole("button", { name: /Draft points to discuss/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("isn't available"));
    expect((action.mock.calls[0]?.[1] as FormData).get("appointmentId")).toBe("a1");
    fireEvent.click(screen.getByRole("button", { name: /Draft points to discuss/ }));
    await waitFor(() => expect(screen.getByText("What should we watch for?")).toBeInTheDocument());
    expect(screen.getByText("Nothing stood out in the facts.")).toBeInTheDocument();
  });
});

describe("PrintButton", () => {
  it("opens the print dialog", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<PrintButton />);
    fireEvent.click(screen.getByRole("button", { name: "Print this brief" }));
    expect(print).toHaveBeenCalled();
  });
});
