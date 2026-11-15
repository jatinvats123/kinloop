// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import type { Proposal } from "@/domain/types";
import type { LabelCheckResult } from "@/server/services/label-check";
import type { MedicineDraft } from "@/server/services/prescription-import";
import { LabelCheck } from "./check/label-check";
import { PrescriptionImport } from "./import/prescription-import";
import { LinkActionForm } from "./links/link-action-form";
import { TestReminderForm } from "./reminders/test-reminder-form";
import { ProposalCards } from "./today/proposal-cards";

const strings = {
  takePhoto: "Take or choose a photo",
  checking: "Reading the label…",
  again: "Check another",
  markTaken: "Mark as taken",
  samples: "Try a sample label",
};

const proposal: Proposal = {
  id: "p1",
  kind: "add",
  itemId: null,
  payload: null,
  summary: "add medicine Vitamin D3 60000 IU at 09:00",
  proposedBy: "m-priya",
  proposedByName: "Priya",
  status: "pending",
  createdAt: "2026-11-15T05:00:00.000Z",
  decidedAt: null,
};

const draft: MedicineDraft = {
  key: "d0",
  name: "Pantoprazole",
  composition: "",
  dose: "40 mg",
  instructions: "Before breakfast",
  times: ["08:00"],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startDate: "2026-11-15",
  endDate: "2026-11-28",
  unsure: ["dose"],
};

const pngFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "label.png", {
    type: "image/png",
  });

describe("Ask me first cards", () => {
  it("give the elder labelled approve and decline buttons", async () => {
    const { container } = render(
      <ProposalCards proposals={[proposal]} canDecide elderFirstName="Kamla" action={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Changes waiting for you" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Approve: add medicine Vitamin D3/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Decline: add medicine Vitamin D3/ }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("show others what is waiting, without buttons, and nothing when empty", () => {
    const { rerender } = render(
      <ProposalCards
        proposals={[proposal]}
        canDecide={false}
        elderFirstName="Kamla"
        action={vi.fn()}
      />,
    );
    expect(screen.getByText("Waiting for Kamla's approval")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<ProposalCards proposals={[]} canDecide elderFirstName="Kamla" action={vi.fn()} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("email link button", () => {
  it("posts the token and announces the outcome", async () => {
    const action = vi.fn(async () => ({ ok: true as const, message: "Thank you." }));
    const { container } = render(
      <LinkActionForm
        action={action}
        token="tok"
        label="Yes, I've taken them"
        pendingText="Saving…"
      />,
    );
    await expectNoAxeViolations(container);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, I've taken them" }));
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Thank you."));
    const fd = (action.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(fd.get("t")).toBe("tok");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("test reminder form", () => {
  it("labels the email field and has no axe violations", async () => {
    const { container } = render(
      <TestReminderForm
        action={vi.fn(async () => ({ ok: true as const }))}
        email="p@example.com"
        hint="Used only here."
      />,
    );
    expect(screen.getByLabelText(/Your email/)).toHaveValue("p@example.com");
    await expectNoAxeViolations(container);
  });
});

describe("right-medicine check", () => {
  const due: LabelCheckResult = {
    verdict: "due-now",
    message: "Yes. This is your 8:00 AM Metformin 500 mg.",
    mark: { slotAt: "2026-11-15T02:30:00.000Z", itemId: "met" },
  };

  it("offers a camera photo, sample labels, and has no axe violations", async () => {
    const { container } = render(
      <LabelCheck
        checkAction={vi.fn()}
        takeAction={vi.fn()}
        samples={[{ src: "/samples/a.webp", label: "Amlodipine 5 mg" }]}
        strings={strings}
      />,
    );
    const input = screen.getByLabelText("Take or choose a photo");
    expect(input).toHaveAttribute("capture", "environment");
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
    expect(screen.getByRole("button", { name: "Amlodipine 5 mg" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("shows a due-now verdict with Mark as taken, and can start again", async () => {
    const check = vi.fn(async () => ({ ok: true as const, data: due }));
    const { container } = render(
      <LabelCheck checkAction={check} takeAction={vi.fn()} samples={[]} strings={strings} />,
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Take or choose a photo"), {
        target: { files: [pngFile()] },
      });
    });
    await waitFor(() => expect(screen.getByText(due.message)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Mark as taken" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
    fireEvent.click(screen.getByRole("button", { name: "Check another" }));
    expect(screen.queryByText(due.message)).toBeNull();
  });

  it("shows a stop verdict without Mark as taken, and errors as alerts", async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { verdict: "not-on-list", message: "Not on your list.", mark: null },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "x",
        fieldErrors: { photo: "Use a PNG, JPEG or WebP photo." },
      });
    render(<LabelCheck checkAction={check} takeAction={vi.fn()} samples={[]} strings={strings} />);
    const input = screen.getByLabelText("Take or choose a photo");
    await act(async () => {
      fireEvent.change(input, { target: { files: [pngFile()] } });
    });
    await waitFor(() => expect(screen.getByText("Not on your list.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Mark as taken" })).toBeNull();
    await act(async () => {
      fireEvent.change(input, { target: { files: [pngFile()] } });
    });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Use a PNG, JPEG or WebP photo."),
    );
  });
});

describe("prescription import", () => {
  it("asks for text or a photo and has no axe violations", async () => {
    const { container } = render(
      <PrescriptionImport draftAction={vi.fn()} acceptAction={vi.fn()} />,
    );
    expect(screen.getByLabelText("Paste the prescription")).toBeInTheDocument();
    expect(screen.getByLabelText("Or choose a photo of it")).toHaveAttribute("type", "file");
    await expectNoAxeViolations(container);
  });

  it("lists drafts for review, flags unsure fields, accepts and discards", async () => {
    const draftAction = vi.fn(async () => ({
      ok: true as const,
      data: [draft, { ...draft, key: "d1", name: "Telmisartan", unsure: [] }],
    }));
    const acceptAction = vi.fn(async () => ({
      ok: true as const,
      message: "Added to the medicines list.",
    }));
    const { container } = render(
      <PrescriptionImport draftAction={draftAction} acceptAction={acceptAction} />,
    );
    fireEvent.change(screen.getByLabelText("Paste the prescription"), {
      target: { value: "Tab Pantoprazole 40 mg OD" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Read prescription" }));
    });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Review the drafts" })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Some fields need a second look: dose/)).toBeInTheDocument();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: /Discard\s*Telmisartan/ }));
    expect(screen.queryByRole("heading", { name: "Telmisartan" })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add this medicine" }));
    });
    await waitFor(() =>
      expect(screen.getByText("Pantoprazole: Added to the medicines list.")).toBeInTheDocument(),
    );
    const fd = (acceptAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(fd.getAll("times")).toEqual(["08:00"]);
    expect(fd.get("endDate")).toBe("2026-11-28");
  });

  it("explains when nothing was found or the reader failed", async () => {
    const draftAction = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({
        ok: false,
        error: "The prescription reader isn't available right now.",
      });
    render(<PrescriptionImport draftAction={draftAction} acceptAction={vi.fn()} />);
    const read = screen.getByRole("button", { name: "Read prescription" });
    await act(async () => {
      fireEvent.click(read);
    });
    await waitFor(() => expect(screen.getByText(/No medicines found/)).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(read);
    });
    await waitFor(() => expect(screen.getByText(/isn't available right now/)).toBeInTheDocument());
  });
});
